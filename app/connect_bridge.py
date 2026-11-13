"""Authenticated, idempotent bridge from canonical Noetfield Platform intake.

This module imports a scoped people/contributor application into existing
WorkforceOS opportunity and collaboration tables.  It does not create a
second inbox, assign work, run agents, or manufacture outcome receipts.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from .storage import database, email_normalize
from .opportunity_os import KINDS, record_event
from .collaborate import FOCUS, AVAILABILITY

router = APIRouter()
SOURCE_ID = re.compile(r"^INT-[A-Za-z0-9-]{6,80}$")
SOURCES = {"linkedin", "referral", "email", "event", "website", "community", "direct", "other"}
ROLE_FOCUS = {"engineering": "engineering", "qa": "engineering", "design": "design",
              "growth": "growth", "research": "product", "operations": "operations",
              "community": "growth", "partner": "growth"}
AVAILABILITY_MAP = {"now": "now", "soon": "two_weeks", "two_weeks": "two_weeks",
                    "parttime": "part_time", "part_time": "part_time",
                    "project": "project", "exploring": "exploring"}


class SourceIntake(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_intake_id: str = Field(min_length=10, max_length=84)
    source_request_id: str = Field(default="", max_length=80)
    vector: str = Field(min_length=4, max_length=80)
    contact_name: str = Field(default="", max_length=120)
    contact_email: str = Field(min_length=5, max_length=254)
    organization: str = Field(default="", max_length=200)
    message: str = Field(min_length=10, max_length=8000)
    metadata: dict[str, object] = Field(default_factory=dict)


def _value(metadata: dict[str, object], key: str, cap: int = 500) -> str:
    value = metadata.get(key)
    return value.strip()[:cap] if isinstance(value, str) else ""


def _safe_https(raw: str) -> str:
    if not raw or len(raw) > 500:
        return ""
    try:
        u = urlsplit(raw)
        return raw if (u.scheme == "https" and u.hostname and
                       not u.username and not u.password and
                       not any(ch.isspace() for ch in raw)) else ""
    except ValueError:
        return ""


def _prepare(body: SourceIntake) -> dict[str, str | bool]:
    m = body.metadata
    if not SOURCE_ID.fullmatch(body.source_intake_id):
        raise HTTPException(422, "INVALID_SOURCE_INTAKE_ID")
    if len(str(m)) > 14000:
        raise HTTPException(422, "METADATA_TOO_LARGE")
    if body.vector == "external-opportunities":
        if m.get("category") != "people" or m.get("consent_contact") is not True:
            raise HTTPException(422, "NOT_A_CONSENTED_PEOPLE_OPPORTUNITY")
        role = _value(m, "participant_role", 40)
        kind = "agent_work" if role == "ai_operator" else "recruiting"
        lane = "agent_owner" if role == "ai_operator" else "freelancer"
        skills = _value(m, "skills", 800)
        focus = _value(m, "focus", 40)
        if focus not in FOCUS:
            focus = "other"
        initiative = _value(m, "initiative", 80) or "unspecified"
        portfolio = _safe_https(_value(m, "portfolio_url", 500))
        linkedin = _safe_https(_value(m, "linkedin_url", 500))
        origin_context = _value(m, "conversation_context", 1500)
        campaign = _value(m, "utm_campaign", 80)
        availability = AVAILABILITY_MAP.get(_value(m, "availability", 40), "exploring")
        collaboration_model = _value(m, "work_model", 80)
        desired_role = role
    elif body.vector == "work-with-us-contributor":
        # Public contributor form requires affirmative contact consent; the
        # canonical submitted metadata preserves it for server-side handoff.
        if m.get("consent_contact") is not True:
            raise HTTPException(422, "CONTACT_CONSENT_NOT_RECORDED")
        application_kind = _value(m, "application_kind", 40)
        if application_kind not in {"human", "agent", "organization"}:
            raise HTTPException(422, "INVALID_CONTRIBUTOR_KIND")
        role = _value(m, "role", 40)
        if role not in ROLE_FOCUS:
            raise HTTPException(422, "INVALID_CONTRIBUTOR_ROLE")
        kind = ("agent_work" if application_kind == "agent" else
                "partnership" if application_kind == "organization" else "recruiting")
        lane = ("agent_owner" if application_kind == "agent" else
                "company" if application_kind == "organization" else
                "sales_partner" if role in {"growth", "partner"} else "freelancer")
        focus = ROLE_FOCUS[role]
        initiative = _value(m, "project_id", 80) or "unspecified"
        portfolio = _safe_https(_value(m, "evidence_url", 500))
        linkedin = ""
        skills = "Self-reported role: " + role + "; proposed project: " + initiative
        origin_context = "Contributor application via Noetfield /work-with-us/contribute/"
        campaign = ""
        availability = "exploring"
        collaboration_model = "scoped_collaboration"
        desired_role = role
    else:
        raise HTTPException(422, "UNSUPPORTED_SOURCE_VECTOR")

    try:
        email = email_normalize(body.contact_email)
    except ValueError as exc:
        raise HTTPException(422, "INVALID_EMAIL") from exc
    source = _value(m, "lead_source", 40) or "website"
    if source not in SOURCES:
        source = "other" if source else "website"
    name = body.contact_name.strip() or body.organization.strip() or "Noetfield contributor"
    proposal = body.message.strip()[:4500]
    if len(proposal) < 20:
        raise HTTPException(422, "INSUFFICIENT_PROPOSAL")
    context = ("Canonical Noetfield intake: " + body.source_intake_id +
               "; vector=" + body.vector + "; origin=" + source +
               "; original conversation=" + (origin_context or "not provided"))[:3000]
    return {
        "email": email, "full_name": name[:120], "organization": body.organization[:140],
        "source": source, "source_context": context, "source_url": linkedin,
        "kind": kind, "lane": lane, "focus": focus, "skills": skills[:800] or "Details in original source proposal",
        "availability": availability, "venture": initiative, "intent": proposal,
        "participant": "ai" if kind == "agent_work" else "human",
        "relevant_url": portfolio or linkedin, "linkedin_url": linkedin,
        "portfolio_url": portfolio, "campaign": campaign if re.fullmatch(r"[A-Za-z0-9_.-]{0,80}", campaign) else "",
        "collaboration_model": collaboration_model, "desired_role": desired_role,
        "original_context": origin_context[:1500],
        "consent_contact": True,
        "source_request_id": body.source_request_id[:80],
    }


def _authorize(request: Request) -> None:
    expected = os.getenv("WORKFORCE_CONNECT_BRIDGE_KEY", "")
    presented = request.headers.get("X-Noetfield-Bridge-Key", "")
    if len(expected) < 32 or not presented or not hmac.compare_digest(expected, presented):
        raise HTTPException(403, "INTEGRATION_ACCESS_DENIED")


@router.get("/api/integrations/noetfield-connect/health")
def bridge_read_only_health(request: Request):
    """Authenticated network + database handshake; never creates an applicant."""
    _authorize(request)
    with database() as db:
        db.execute("SELECT 1").fetchone()
    return {"authenticated": True, "database": "connected",
            "mode": "consent_scoped_idempotent_source_projection",
            "read_only": True, "source_key": "source_intake_id"}


@router.post("/api/integrations/noetfield-connect", status_code=200)
def import_canonical_connect(request: Request, body: SourceIntake):
    _authorize(request)
    p = _prepare(body)
    case_id = "opp_nf_" + hashlib.sha256(body.source_intake_id.encode()).hexdigest()[:24]
    today = datetime.now(timezone.utc).date()
    due = today + timedelta(days=1)
    while due.weekday() >= 5:
        due += timedelta(days=1)
    kind_label, specialist, work_lane = KINDS[p["kind"]]
    with database() as db:
        # Unique source_intake_id + deterministic id produce an idempotent,
        # race-safe projection without modifying a pre-existing review.
        inserted = db.execute("""INSERT INTO opportunity_cases (
            id, tracking_hash, source_intake_id, source_request_id,
            full_name, email, organization, source, source_url, source_context,
            kind, intent, venture, participant, relevant_url, proposed_route,
            suggested_specialist, integration_lane, route_basis,
            owner, next_action, next_date
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
          ON CONFLICT DO NOTHING RETURNING id""",
            (case_id, hashlib.sha256(secrets.token_bytes(32)).hexdigest(),
             body.source_intake_id, p["source_request_id"],
             p["full_name"], p["email"], p["organization"],
             p["source"], p["source_url"], p["source_context"],
             p["kind"], p["intent"], p["venture"], p["participant"],
             p["relevant_url"], kind_label, specialist, work_lane,
             "Source-backed import only; qualification, match, assignment and verification are pending",
             "intake_queue", "Review source proposal; qualify candidate and choose next action", due)).fetchone()
        if not inserted:
            existing = db.execute(
                "SELECT id FROM opportunity_cases WHERE source_intake_id=%s",
                (body.source_intake_id,)).fetchone()
            if not existing or existing["id"] != case_id:
                raise HTTPException(409, "SOURCE_ID_COLLISION")
            return {"accepted": True, "deduped": True, "case_id": case_id,
                    "source_intake_id": body.source_intake_id,
                    "assigned": False, "independently_verified": False}

        db.execute("""INSERT INTO collaboration_applications(
          case_id, lane, focus, skills, availability, linkedin_url,
          portfolio_url, campaign, analytics_consent, contact_consent,
          collaboration_model, desired_role, source_message
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,FALSE,TRUE,%s,%s,%s)
          ON CONFLICT (case_id) DO NOTHING""",
            (case_id, p["lane"], p["focus"], p["skills"], p["availability"],
             p["linkedin_url"], p["portfolio_url"], p["campaign"],
             p["collaboration_model"], p["desired_role"], p["original_context"]))
        record_event(db, case_id, "noetfield_connect.source_imported",
                     "canonical_platform", "Confirmed persisted Noetfield source intake " +
                     body.source_intake_id + "; pending human/agent qualification")
    return {"accepted": True, "deduped": False, "case_id": case_id,
            "source_intake_id": body.source_intake_id,
            "assigned": False, "independently_verified": False}


# Platform operator actions are carried over the existing server-to-server
# integration identity. They modify a real WorkforceOS case, never create an
# independent work order or treat an operator note as proof of agent execution.
class ConnectOperatorHandoff(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_intake_id: str = Field(min_length=10, max_length=84)
    request_id: str = Field(min_length=16, max_length=100, pattern=r"^[A-Za-z0-9_-]{16,100}$")
    owner: str = Field(min_length=2, max_length=140)
    next_action: str = Field(min_length=5, max_length=1000)
    due_date: str | None = Field(default=None, max_length=10)
    match_quality: str = Field(default="not_assessed", max_length=20)
    assignment_reference: str = Field(default="", max_length=1500)


def _connect_case_state(row):
    return {
        "source_intake_id": row["source_intake_id"],
        "case_id": row["id"],
        "owner": row["owner"],
        "status": row["status"],
        "stage": row["stage"],
        "collaboration": row["collaboration"],
        "match_quality": row["match_quality"],
        "next_action": row["next_action"],
        "next_date": row["next_date"].isoformat() if row["next_date"] else None,
        "assignment_reference": row["assignment_reference"],
        "outcome": row["outcome"],
        "outcome_evidence": row["outcome_evidence"],
        "verification_reference": row["verification_reference"],
        "verification_state": row["verification_state"],
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        "external_agent_execution_verified": False,
        "collected_cash_verified": False,
    }


@router.get("/api/integrations/noetfield-connect/cases/{source_intake_id}")
def read_canonical_connect_case(request: Request, source_intake_id: str):
    """Authenticated, PII-minimal readback of the existing WorkforceOS case."""
    _authorize(request)
    if not SOURCE_ID.fullmatch(source_intake_id):
        raise HTTPException(422, "INVALID_SOURCE_INTAKE_ID")
    with database() as db:
        row = db.execute(
            "SELECT * FROM opportunity_cases WHERE source_intake_id=%s",
            (source_intake_id,),
        ).fetchone()
    if not row:
        raise HTTPException(404, "SOURCE_CASE_NOT_FOUND")
    return {"found": True, "source": "workforce_os_postgres",
            "case": _connect_case_state(row)}


@router.post("/api/integrations/noetfield-connect/handoff")
def record_canonical_connect_handoff(request: Request, body: ConnectOperatorHandoff):
    """Idempotently assign a real operator to an already-consented source case.

    A reference to an actual workpacket may be supplied; it is not independently
    verified, does not trigger an agent, and is never an authorization grant.
    """
    _authorize(request)
    if not SOURCE_ID.fullmatch(body.source_intake_id):
        raise HTTPException(422, "INVALID_SOURCE_INTAKE_ID")
    owner, action = body.owner.strip(), body.next_action.strip()
    if len(owner) < 2 or owner.lower() in {"intake_queue", "unassigned", "none"}:
        raise HTTPException(422, "ACTUAL_OPERATOR_OWNER_REQUIRED")
    if len(action) < 5:
        raise HTTPException(422, "NEXT_ACTION_REQUIRED")
    if body.match_quality not in {"not_assessed", "low", "medium", "high"}:
        raise HTTPException(422, "MATCH_QUALITY_INVALID")
    if body.assignment_reference and (
        not body.assignment_reference.startswith("https://")
        or any(c.isspace() for c in body.assignment_reference)
        or urlsplit(body.assignment_reference).username
        or urlsplit(body.assignment_reference).password
        or not urlsplit(body.assignment_reference).hostname
    ):
        raise HTTPException(422, "HTTPS_ASSIGNMENT_REFERENCE_REQUIRED")
    due = None
    if body.due_date:
        try:
            due = datetime.strptime(body.due_date, "%Y-%m-%d").date()
        except ValueError as exc:
            raise HTTPException(422, "DUE_DATE_INVALID") from exc
    with database() as db:
        row = db.execute(
            "SELECT * FROM opportunity_cases WHERE source_intake_id=%s FOR UPDATE",
            (body.source_intake_id,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "SOURCE_CASE_NOT_FOUND")
        was_sent = db.execute(
            """SELECT id FROM opportunity_events
               WHERE case_id=%s AND event_type='noetfield_connect.operator_handoff'
                 AND body=%s LIMIT 1""",
            (row["id"], body.request_id),
        ).fetchone()
        if was_sent:
            return {"accepted": True, "deduped": True,
                    "case": _connect_case_state(row),
                    "external_agent_executed": False,
                    "independently_verified": False}
        if row["status"] in {"won", "lost", "archived"}:
            raise HTTPException(409, "CASE_ALREADY_CLOSED")
        assigned = bool(body.assignment_reference)
        new = db.execute(
            """UPDATE opportunity_cases SET
                 owner=%s, next_action=%s, next_date=%s, match_quality=%s,
                 assignment_reference=%s, status='in_review',
                 stage=%s, collaboration=%s, updated_at=now()
               WHERE id=%s RETURNING *""",
            (owner, action, due, body.match_quality, body.assignment_reference,
             "handoff" if assigned else "qualifying",
             "handoff_recorded" if assigned else "suggested", row["id"]),
        ).fetchone()
        record_event(db, row["id"], "noetfield_connect.operator_handoff",
                     "noetfield_connect_operator", body.request_id)
    return {"accepted": True, "deduped": False, "case": _connect_case_state(new),
            "external_agent_executed": False, "independently_verified": False}
