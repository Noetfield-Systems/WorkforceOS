"""Evidence-first private candidate intelligence and real opportunity shortlisting.

Suggestions are computed solely from existing Postgres cases, never invented
work opportunities. There is no model inference cost, external outreach,
assignment, fabricated skill verification, or cross-tenant public exposure.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from .storage import database
from .opportunity_os import operator

router = APIRouter()
TOKENS = re.compile(r"[a-z0-9][a-z0-9.+#-]{2,}")
STOP = {"and","the","for","with","from","about","this","that","have","can",
        "will","are","our","your","their","would","should","work","project",
        "help","team","test","build","into","need","using","want","real",
        "available","engineer","developer","system","systems","software",
        "applicant","application","business","service","services","2026"}
MAX_SUGGESTIONS = 5


def keywords(text: str) -> set[str]:
    return {t for t in TOKENS.findall((text or "").lower())
            if t not in STOP and not t.isdigit()}


def evidence_profile(candidate: dict[str, Any]) -> dict[str, object]:
    """Measure only voluntarily supplied evidence; don't infer ability or identity."""
    source_id = str(candidate.get("source_intake_id") or "")
    skills = str(candidate.get("skills") or "").strip()
    proposal = str(candidate.get("intent") or "").strip()
    availability = str(candidate.get("availability") or "")
    proof_url = str(candidate.get("portfolio_url") or candidate.get("linkedin_url") or "").strip()
    original = str(candidate.get("source_message") or "").strip()
    checks = {
        "skills_declared": bool(skills) and "Details in original source" not in skills,
        "proposal_substantive": len(proposal) >= 120,
        "portfolio_link_supplied": proof_url.startswith("https://"),
        "availability_declared": availability not in {"", "exploring"},
        "original_conversation_supplied": bool(original) and "Contributor application via" not in original,
        "desired_role_declared": bool(str(candidate.get("desired_role") or "").strip()),
    }
    missing = [name for name, present in checks.items() if not present]
    present = [name for name, ok in checks.items() if ok]
    completion = round(100 * len(present) / len(checks))
    focus = str(candidate.get("focus") or "other")[:40]
    next_action = (
        "Request a public work sample and verify it matches the claimed role."
        if not checks["portfolio_link_supplied"] else
        "Request a bounded trial scope, availability confirmation and measurable deliverable."
        if not checks["availability_declared"] else
        "Review supplied work samples independently; propose a paid scoped pilot if demand is confirmed."
    )
    return {
        "source_case_id": str(candidate.get("case_id") or ""),
        "canonical_intake_id": source_id or None,
        "origin": str(candidate.get("source") or "other"),
        "self_declared_focus": focus,
        "profile_completeness_percent": completion,
        "present_evidence_fields": present,
        "missing_evidence_fields": missing,
        "next_action_suggestion": next_action,
        "claims_verified": False,
        "agent_work_dispatched": False,
        "scope": "human/agent operator advisory only",
    }


def rank_related(candidate: dict[str, Any], supply: list[dict[str, Any]]) -> list[dict[str, object]]:
    """Related *inbound inquiries*, not open jobs, matches or confirmed projects."""
    skills = keywords(" ".join(str(candidate.get(k) or "")
                               for k in ("skills","focus","desired_role","intent")))
    venture = str(candidate.get("venture") or "").strip().lower()
    outcomes: list[dict[str, object]] = []
    for item in supply:
        if str(item.get("id")) == str(candidate.get("case_id")):
            continue
        if item.get("status") in {"won","lost","archived"}:
            continue
        if item.get("kind") not in {"customer","agent_work"}:
            continue
        opportunity_venture = str(item.get("venture") or "").strip().lower()
        # Never join unrelated independent ventures just because a token matches.
        if not venture or venture in {"unspecified", "portfolio", "trustfield"}:
            continue
        if opportunity_venture != venture:
            continue
        overlap = sorted(skills & keywords(str(item.get("intent") or "")))
        if not overlap:
            continue
        outcomes.append({
            "case_id": str(item["id"]),
            "venture": venture,
            "inquiry_kind": str(item["kind"]),
            "overlapping_self_reported_terms": overlap[:8],
            "overlap_count": len(overlap),
            "match_status": "RELATED_INQUIRY_REQUIRES_OPERATOR_REVIEW",
            "verified_open_assignment": False,
        })
    outcomes.sort(key=lambda x: (-int(x["overlap_count"]), str(x["case_id"])))
    return outcomes[:MAX_SUGGESTIONS]


@router.get("/api/collaborate/operator/people/{case_id}/intelligence",
            dependencies=[Depends(operator)])
def candidate_intelligence(case_id: str):
    with database() as db:
        candidate = db.execute("""SELECT a.case_id,a.skills,a.availability,
          a.portfolio_url,a.linkedin_url,a.source_message,a.desired_role,a.focus,
          c.intent,c.venture,c.source,c.source_intake_id
          FROM collaboration_applications a JOIN opportunity_cases c
            ON c.id=a.case_id WHERE a.case_id=%s""",
            (case_id,)).fetchone()
        if not candidate:
            raise HTTPException(404, "CANDIDATE_NOT_FOUND")
        venture = str(candidate["venture"] or "")
        supply = db.execute("""SELECT id,kind,intent,venture,status
              FROM opportunity_cases WHERE venture=%s AND id<>%s
                AND kind IN ('customer','agent_work')
                AND status NOT IN ('won','lost','archived')
              ORDER BY created_at DESC LIMIT 150""",
              (venture, case_id)).fetchall() if venture not in {
                  "unspecified","portfolio","trustfield",""} else []
    profile = evidence_profile(dict(candidate))
    related = rank_related(dict(candidate), [dict(x) for x in supply])
    return {
        "candidate": profile, "related_source_inquiries": related,
        "related_count": len(related), "matched_job_count": 0,
        "actual_assignment_created": False, "independently_verified": False,
        "decision": ("REVIEW_RELATED_INQUIRIES" if related
                     else "NO_CONFIRMED_OPEN_ASSIGNMENT_IN_SOURCE"),
        "notice": "Completeness is NOT a skill score or hiring decision. "
                  "Related inquiries are real internal cases, NOT proof of an open job.",
    }
