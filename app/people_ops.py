"""Founder Connect people operations over existing opportunity_cases and collaboration_applications.

No new queue, registry, agent, scheduler or verification service. All source handoffs
are explicit references; a URL alone never means external execution or verification.
"""
from __future__ import annotations

import hashlib
import hmac
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .storage import database
from .opportunity_os import (operator, record_event, serialize, valid_url,
    STATUSES, STAGES, COLLAB, MATCH, OUTCOMES)

router = APIRouter()
PUBLIC = Path(__file__).resolve().parent.parent / "public"
QUALIFICATION = {"unreviewed", "needs_information", "qualified", "not_fit"}
TARGETS = {"none", "workforce_os", "agent_os", "workflow_os",
           "workfeed", "company_os", "sina_founder_os"}
PEOPLE_FIELDS = ("case_id", "full_name", "email", "organization", "source",
    "source_context", "intent", "venture", "lane", "focus", "skills", "availability",
    "linkedin_url", "portfolio_url", "location", "languages", "time_commitment",
    "collaboration_model", "rate_expectation", "project_preference",
    "desired_role", "collaboration_goal", "source_message", "referral_code",
    "campaign", "qualification", "candidate_role", "match_basis", "pilot_scope",
    "internal_feedback", "invitation_reference", "handoff_target", "owner",
    "status", "stage", "collaboration", "match_quality", "next_action", "next_date",
    "assignment_reference", "outcome", "outcome_evidence",
    "verification_reference", "verification_state", "created_at", "updated_at")

def initialize_people():
    with database() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS collaboration_reviews (
            case_id text PRIMARY KEY REFERENCES collaboration_applications(case_id)
                ON DELETE CASCADE,
            qualification text NOT NULL DEFAULT 'unreviewed',
            candidate_role text NOT NULL DEFAULT '',
            match_basis text NOT NULL DEFAULT '',
            pilot_scope text NOT NULL DEFAULT '',
            internal_feedback text NOT NULL DEFAULT '',
            invitation_reference text NOT NULL DEFAULT '',
            handoff_target text NOT NULL DEFAULT 'none',
            updated_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS collaboration_reviews_qualification_idx
                   ON collaboration_reviews(qualification)""")

@router.get("/connect/desk")
def founder_desk_page():
    return FileResponse(PUBLIC / "connect-desk.html", media_type="text/html",
        headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow"})

def _joined():
    return """ FROM collaboration_applications a
        JOIN opportunity_cases c ON c.id=a.case_id
        LEFT JOIN collaboration_reviews r ON r.case_id=a.case_id """

def _select():
    return """SELECT a.*, c.full_name,c.email,c.organization,c.source,
        c.source_context,c.intent,c.venture,c.owner,c.status,c.stage,
        c.collaboration,c.match_quality,c.next_action,c.next_date,
        c.assignment_reference,c.outcome,c.outcome_evidence,
        c.verification_reference,c.verification_state,c.updated_at,
        COALESCE(r.qualification,'unreviewed') AS qualification,
        COALESCE(r.candidate_role,'') AS candidate_role,
        COALESCE(r.match_basis,'') AS match_basis,
        COALESCE(r.pilot_scope,'') AS pilot_scope,
        COALESCE(r.internal_feedback,'') AS internal_feedback,
        COALESCE(r.invitation_reference,'') AS invitation_reference,
        COALESCE(r.handoff_target,'none') AS handoff_target """

def _public(row):
    return serialize(row, PEOPLE_FIELDS)

@router.get("/api/collaborate/operator/people", dependencies=[Depends(operator)])
def people(view: str = "all", q: str = "", focus: str = "",
           source: str = "", stage: str = "", owner: str = "",
           availability: str = "", match_quality: str = "",
           qualification: str = "", limit: int = 150):
    if view not in {"all", "inbound", "due", "qualified", "shortlist",
                    "active", "shipped", "verified"} or len(q)>100 or len(owner)>140 or not 1<=limit<=200:
        raise HTTPException(422, "INVALID_FILTER")
    if (stage and stage not in STAGES) or (source and source not in
        {"linkedin","referral","email","event","website","community","direct","other"}):
        raise HTTPException(422,"INVALID_FILTER")
    if (match_quality and match_quality not in MATCH) or (qualification and qualification not in QUALIFICATION):
        raise HTTPException(422,"INVALID_FILTER")
    where=["TRUE"]; args=[]
    for field,value in (("a.focus",focus),("c.source",source),("c.stage",stage),
                        ("a.availability",availability),("c.match_quality",match_quality)):
        if value:
            if len(value)>100: raise HTTPException(422,"INVALID_FILTER")
            where.append(field+"=%s");args.append(value)
    if qualification:
        where.append("COALESCE(r.qualification,'unreviewed')=%s");args.append(qualification)
    if owner:
        where.append("c.owner ILIKE %s");args.append("%"+owner+"%")
    if q:
        where.append("""(c.full_name ILIKE %s OR c.email ILIKE %s
             OR a.skills ILIKE %s OR c.id ILIKE %s OR c.intent ILIKE %s)""")
        args.extend(["%"+q+"%"]*5)
    views={
        "inbound":"c.stage='received'",
        "due":"c.next_date <= CURRENT_DATE AND c.status NOT IN ('won','lost','archived')",
        "qualified":"r.qualification='qualified'",
        "shortlist":"c.stage='matched'",
        "active":"c.collaboration='in_progress'",
        "shipped":"c.outcome='shipped_work' AND c.outcome_evidence<>''",
        "verified":"c.verification_state='VERIFIED_INDEPENDENTLY' AND c.verification_reference<>''",
    }
    if view in views:where.append(views[view])
    with database() as db:
        rows=db.execute(_select()+_joined()+" WHERE "+" AND ".join(where)+
            " ORDER BY c.created_at DESC LIMIT %s",(*args,limit)).fetchall()
        summary=db.execute("""SELECT
          count(*) AS applications,
          count(*) FILTER (WHERE c.stage='received') AS inbound,
          count(*) FILTER (WHERE c.next_date <= CURRENT_DATE
            AND c.status NOT IN ('won','lost','archived')) AS due,
          count(*) FILTER (WHERE r.qualification='qualified') AS qualified,
          count(*) FILTER (WHERE c.stage='matched') AS shortlist,
          count(*) FILTER (WHERE c.collaboration='in_progress') AS active,
          count(*) FILTER (WHERE c.outcome='shipped_work'
            AND c.outcome_evidence<>'') AS shipped,
          count(*) FILTER (WHERE c.verification_state='VERIFIED_INDEPENDENTLY'
            AND c.verification_reference<>'') AS verified
          """+_joined()).fetchone()
    return {"dataset":"REAL_STORED_CASES_ONLY","cases":[_public(x) for x in rows],
            "totals":dict(summary),"returned":len(rows)}

@router.get("/api/collaborate/operator/people/{case_id}",
            dependencies=[Depends(operator)])
def person_detail(case_id: str):
    with database() as db:
        row=db.execute(_select()+_joined()+" WHERE a.case_id=%s",
                       (case_id,)).fetchone()
        if not row:raise HTTPException(404,"NOT_FOUND")
        history=db.execute("""SELECT id,event_type,actor,body,evidence_url,created_at
            FROM opportunity_events WHERE case_id=%s ORDER BY id DESC LIMIT 150""",
            (case_id,)).fetchall()
        feedback=db.execute("""SELECT rating,message,created_at
            FROM collaboration_feedback WHERE case_id=%s ORDER BY id DESC LIMIT 60""",
            (case_id,)).fetchall()
    return {"case":_public(row),
            "events":[serialize(x,tuple(x)) for x in history],
            "applicant_feedback":[serialize(x,tuple(x)) for x in feedback]}

class Review(BaseModel):
    qualification: str | None = None
    candidate_role: str | None = Field(default=None,max_length=140)
    match_basis: str | None = Field(default=None,max_length=1500)
    pilot_scope: str | None = Field(default=None,max_length=2000)
    internal_feedback: str | None = Field(default=None,max_length=3000)
    invitation_reference: str | None = Field(default=None,max_length=1500)
    handoff_target: str | None = None
    owner: str | None = Field(default=None,min_length=2,max_length=140)
    next_action: str | None = Field(default=None,min_length=3,max_length=2000)
    next_date: date | None = None
    match_quality: str | None = None
    status: str | None = None
    stage: str | None = None
    collaboration: str | None = None
    assignment_reference: str | None = Field(default=None,max_length=1500)
    outcome: str | None = None
    outcome_evidence: str | None = Field(default=None,max_length=1500)
    verification_reference: str | None = Field(default=None,max_length=1500)

@router.patch("/api/collaborate/operator/people/{case_id}/review",
              dependencies=[Depends(operator)])
def review_person(case_id: str, body: Review):
    changes=body.model_dump(exclude_unset=True)
    if not changes:raise HTTPException(422,"NO_CHANGES")
    for field,allowed in (("qualification",QUALIFICATION),("handoff_target",TARGETS),
        ("match_quality",MATCH),("status",STATUSES),("stage",STAGES),
        ("collaboration",COLLAB),("outcome",OUTCOMES)):
        if field in changes and changes[field] not in allowed:
            raise HTTPException(422,"INVALID_"+field.upper())
    for field in ("invitation_reference","assignment_reference","outcome_evidence",
                  "verification_reference"):
        if field in changes and changes[field] and not valid_url(changes[field]):
            raise HTTPException(422,"HTTPS_REFERENCE_REQUIRED")
    review_cols={"qualification","candidate_role","match_basis","pilot_scope",
                 "internal_feedback","invitation_reference","handoff_target"}
    case_cols=set(Review.model_fields)-review_cols
    with database() as db:
        current=db.execute(_select()+_joined()+" WHERE a.case_id=%s FOR UPDATE OF c",
                           (case_id,)).fetchone()
        if not current:raise HTTPException(404,"NOT_FOUND")
        final={**dict(current),**changes}
        if final["stage"] in {"matched","handoff","executing","converted"}:
            if final["qualification"]!="qualified" or final["match_quality"]=="not_assessed" or not final["match_basis"].strip():
                raise HTTPException(422,"QUALIFICATION_AND_MATCH_EVIDENCE_REQUIRED")
        if final["stage"] in {"handoff","executing","converted"} and not final["assignment_reference"]:
            raise HTTPException(422,"REAL_ASSIGNMENT_REFERENCE_REQUIRED")
        if final["collaboration"] in {"handoff_recorded","in_progress","completed"} and not final["assignment_reference"]:
            raise HTTPException(422,"REAL_ASSIGNMENT_REFERENCE_REQUIRED")
        if final["outcome"]!="none" and not final["outcome_evidence"]:
            raise HTTPException(422,"OUTCOME_EVIDENCE_REQUIRED")
        if final["status"]=="won" and final["outcome"]=="none":
            raise HTTPException(422,"OUTCOME_REQUIRED")
        if final["stage"]=="converted" and final["outcome"]=="none":
            raise HTTPException(422,"OUTCOME_REQUIRED")
        if final["outcome"]=="shipped_work" and (not final["assignment_reference"] or not final["outcome_evidence"]):
            raise HTTPException(422,"DELIVERY_EVIDENCE_REQUIRED")
        if final["handoff_target"]!="none" and not final["assignment_reference"]:
            raise HTTPException(422,"HANDOFF_REFERENCE_REQUIRED")
        if not str(final["next_action"] or "").strip():
            raise HTTPException(422,"NEXT_ACTION_REQUIRED")
        # No manufactured verifier status: every supplied reference is unverified metadata.
        for field in case_cols:
            if field in changes and current[field]!=changes[field]:
                db.execute("UPDATE opportunity_cases SET "+field+
                           "=%s,updated_at=now() WHERE id=%s",
                           (changes[field],case_id))
        review_changes={k:v for k,v in changes.items() if k in review_cols}
        if review_changes:
            db.execute("""INSERT INTO collaboration_reviews(case_id)
                          VALUES (%s) ON CONFLICT (case_id) DO NOTHING""",(case_id,))
            for field,value in review_changes.items():
                db.execute("UPDATE collaboration_reviews SET "+field+
                    "=%s,updated_at=now() WHERE case_id=%s",(value,case_id))
        changed=[k for k,v in changes.items() if current.get(k)!=v]
        if changed:
            record_event(db,case_id,"collaboration.review_updated","authorized_operator",
                "Updated fields: "+", ".join(changed))
        row=db.execute(_select()+_joined()+" WHERE a.case_id=%s",(case_id,)).fetchone()
    return {"case":_public(row),"changed":changed,
            "independently_verified":False,
            "handoff_note":"References are recorded; source acceptance is not asserted."}

class InternalNote(BaseModel):
    kind: str = Field(default="note",max_length=40)
    body: str = Field(min_length=3,max_length=3000)
    evidence_url: str = Field(default="",max_length=1500)

@router.post("/api/collaborate/operator/people/{case_id}/notes",
             dependencies=[Depends(operator)])
def add_note(case_id: str, body: InternalNote):
    if body.kind not in {"note","qualification","matching","handoff","feedback",
                         "evidence","follow_up","invitation"} or not valid_url(body.evidence_url):
        raise HTTPException(422,"INVALID_NOTE")
    with database() as db:
        if not db.execute("SELECT case_id FROM collaboration_applications WHERE case_id=%s",
                          (case_id,)).fetchone():
            raise HTTPException(404,"NOT_FOUND")
        record_event(db,case_id,body.kind,"authorized_operator",
                     body.body.strip(),body.evidence_url.strip())
    return {"recorded":True,"independently_verified":False}

class ApplicantFollowUp(BaseModel):
    tracking_token: str = Field(min_length=32,max_length=200)
    message: str = Field(min_length=5,max_length=2000)
    availability: str | None = Field(default=None,max_length=40)

@router.post("/api/collaborate/cases/{case_id}/follow-up")
def applicant_follow_up(case_id: str, body: ApplicantFollowUp):
    with database() as db:
        row=db.execute("""SELECT c.tracking_hash,a.availability FROM opportunity_cases c
          JOIN collaboration_applications a ON a.case_id=c.id WHERE c.id=%s
          FOR UPDATE OF a""",(case_id,)).fetchone()
        if not row or not hmac.compare_digest(
            row["tracking_hash"],hashlib.sha256(body.tracking_token.encode()).hexdigest()):
            raise HTTPException(404,"NOT_FOUND")
        if body.availability is not None:
            if body.availability not in {"now","two_weeks","part_time","project","exploring"}:
                raise HTTPException(422,"INVALID_AVAILABILITY")
            db.execute("""UPDATE collaboration_applications SET availability=%s
                          WHERE case_id=%s""",(body.availability,case_id))
        db.execute("""UPDATE opportunity_cases SET
                status=CASE WHEN status='new' THEN 'in_review' ELSE status END,
                next_action='Review applicant follow-up and reply',
                next_date=CURRENT_DATE, updated_at=now() WHERE id=%s""",(case_id,))
        record_event(db,case_id,"follow_up","applicant",body.message.strip())
    return {"recorded":True,"case_id":case_id,"assigned":False,"verified":False}
