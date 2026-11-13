"""Dedicated human/partner LinkedIn gateway backed by the existing Opportunity OS.

This gateway does not assign AI agents, promise gigs or claim completed work.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .storage import database, auth_rate_limit, email_normalize
from .opportunity_os import Intake, intake, tracking, operator, record_event
from pathlib import Path

router = APIRouter()
PUBLIC = Path(__file__).resolve().parent.parent / "public"
LANES = {
    "freelancer": ("recruiting", "WorkforceOS / Human collaboration"),
    "sales_partner": ("partnership", "Company OS / Growth and partnerships"),
    "agent_owner": ("agent_work", "Agent OS / Agent integration review"),
    "company": ("partnership", "WorkforceOS / Organization collaboration"),
}
FOCUS = {"engineering", "ai_automation", "design", "growth", "web3",
         "operations", "product", "other"}
AVAILABILITY = {"now", "two_weeks", "part_time", "project", "exploring"}
EVENTS = {"page_view", "wizard_started", "lane_selected", "step_completed",
          "application_attempted", "tracking_opened"}
SESSION_RE = re.compile(r"^[a-zA-Z0-9_-]{16,80}$")
REF_RE = re.compile(r"^[a-zA-Z0-9_.-]{0,80}$")


def initialize_collaboration():
    with database() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS collaboration_applications (
            case_id text PRIMARY KEY REFERENCES opportunity_cases(id) ON DELETE CASCADE,
            lane text NOT NULL,
            focus text NOT NULL,
            skills text NOT NULL,
            availability text NOT NULL,
            linkedin_url text NOT NULL DEFAULT '',
            portfolio_url text NOT NULL DEFAULT '',
            referral_code text NOT NULL DEFAULT '',
            campaign text NOT NULL DEFAULT '',
            visitor_session text NOT NULL DEFAULT '',
            analytics_consent boolean NOT NULL DEFAULT false,
            contact_consent boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS collaboration_created_idx
                      ON collaboration_applications(created_at DESC)""")
        db.execute("""CREATE TABLE IF NOT EXISTS collaboration_events (
            id bigserial PRIMARY KEY,
            session_id text NOT NULL,
            event_name text NOT NULL,
            lane text NOT NULL DEFAULT '',
            source text NOT NULL DEFAULT '',
            campaign text NOT NULL DEFAULT '',
            referral_code text NOT NULL DEFAULT '',
            step integer NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS collaboration_events_created_idx
                      ON collaboration_events(created_at DESC)""")
        db.execute("""CREATE INDEX IF NOT EXISTS collaboration_events_session_idx
                      ON collaboration_events(session_id,created_at DESC)""")
        db.execute("""CREATE TABLE IF NOT EXISTS collaboration_feedback (
            id bigserial PRIMARY KEY,
            case_id text NOT NULL REFERENCES opportunity_cases(id) ON DELETE CASCADE,
            rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
            message text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )""")


@router.get("/join")
@router.get("/collaborate")
@router.get("/work-with-us")
def collaboration_page():
    return FileResponse(PUBLIC / "collaborate.html", media_type="text/html",
                        headers={"Cache-Control": "no-store"})


@router.get("/collaborate/desk")
@router.get("/join/desk")
def collaboration_operator_page():
    return FileResponse(PUBLIC / "collaborate-desk.html", media_type="text/html",
                        headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow"})


class FunnelEvent(BaseModel):
    session_id: str = Field(min_length=16, max_length=80)
    event_name: str = Field(min_length=3, max_length=40)
    source: str = Field(default="linkedin", max_length=40)
    campaign: str = Field(default="", max_length=80)
    referral_code: str = Field(default="", max_length=80)
    lane: str = Field(default="", max_length=30)
    step: int = Field(default=0, ge=0, le=4)
    analytics_consent: bool = False


@router.post("/api/collaborate/events")
def funnel_event(body: FunnelEvent):
    if not body.analytics_consent:
        return {"recorded": False, "reason": "CONSENT_NOT_GIVEN"}
    if (not SESSION_RE.fullmatch(body.session_id)
        or not REF_RE.fullmatch(body.referral_code)
        or not REF_RE.fullmatch(body.campaign)
        or body.event_name not in EVENTS
        or (body.lane and body.lane not in LANES)):
        raise HTTPException(status_code=422, detail="INVALID_EVENT")
    with database() as db:
        # A bounded first-party opt-in event stream, no IP or fingerprint storage.
        recent = db.execute("""SELECT count(*) n FROM collaboration_events
                              WHERE session_id=%s AND created_at>now()-interval '1 hour'""",
                            (body.session_id,)).fetchone()["n"]
        if recent >= 80:
            raise HTTPException(status_code=429, detail="EVENT_LIMIT")
        db.execute("""INSERT INTO collaboration_events
                   (session_id,event_name,lane,source,campaign,referral_code,step)
                   VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                   (body.session_id,body.event_name,body.lane,body.source.strip(),
                    body.campaign,body.referral_code,body.step))
    return {"recorded": True}


class CollaborationApplication(BaseModel):
    full_name: str = Field(min_length=2,max_length=120)
    email: str = Field(min_length=5,max_length=254)
    lane: str = Field(min_length=3,max_length=30)
    focus: str = Field(min_length=3,max_length=40)
    skills: str = Field(min_length=3,max_length=800)
    availability: str = Field(min_length=3,max_length=40)
    proposal: str = Field(min_length=20,max_length=3000)
    linkedin_url: str = Field(default="",max_length=500)
    portfolio_url: str = Field(default="",max_length=500)
    organization: str = Field(default="",max_length=140)
    venture: str = Field(default="unspecified",max_length=80)
    source: str = Field(default="linkedin",max_length=40)
    campaign: str = Field(default="",max_length=80)
    referral_code: str = Field(default="",max_length=80)
    session_id: str = Field(default="",max_length=80)
    analytics_consent: bool = False
    contact_consent: bool = False
    website: str = Field(default="",max_length=150)


def _https_url(value: str) -> bool:
    from urllib.parse import urlsplit
    if not value:
        return True
    try:
        url = urlsplit(value)
        return (url.scheme == "https" and bool(url.hostname)
                and not url.username and not url.password and
                len(value) <= 500 and not any(c.isspace() for c in value))
    except ValueError:
        return False


@router.post("/api/collaborate/apply",status_code=201)
def collaboration_apply(request: Request, body: CollaborationApplication):
    if body.website.strip():
        return {"received": True}  # Honeypot: no fake case created.
    if body.lane not in LANES or body.focus not in FOCUS or body.availability not in AVAILABILITY:
        raise HTTPException(status_code=422,detail="INVALID_ROUTE")
    if not body.contact_consent:
        raise HTTPException(status_code=422,detail="CONTACT_CONSENT_REQUIRED")
    if not REF_RE.fullmatch(body.referral_code) or not REF_RE.fullmatch(body.campaign):
        raise HTTPException(status_code=422,detail="INVALID_ATTRIBUTION")
    if body.session_id and not SESSION_RE.fullmatch(body.session_id):
        raise HTTPException(status_code=422,detail="INVALID_SESSION")
    if not all(_https_url(v.strip()) for v in (body.linkedin_url,body.portfolio_url)):
        raise HTTPException(status_code=422,detail="HTTPS_URL_REQUIRED")
    if not body.skills.strip() or not body.proposal.strip():
        raise HTTPException(status_code=422,detail="DETAILS_REQUIRED")
    try:
        email = email_normalize(body.email)
    except ValueError:
        raise HTTPException(status_code=422,detail="INVALID_EMAIL")
    # The canonical opportunity intake persists the case and private tracking token.
    kind, lane = LANES[body.lane]
    source = body.source if body.source in {"linkedin","referral","email","event","website",
                                            "community","direct","other"} else "other"
    context = (f"WorkforceOS collaboration gateway; source={source}; lane={body.lane}; "
               f"skills={body.skills.strip()[:500]}; availability={body.availability}; "
               f"ref={body.referral_code or 'none'}; campaign={body.campaign or 'none'}")
    profile = Intake(
        full_name=body.full_name.strip(), email=email,
        organization=body.organization.strip(), source=source,
        source_context=context, kind=kind, intent=body.proposal.strip(),
        venture=body.venture.strip() or "unspecified",
        participant="ai" if body.lane=="agent_owner" else "human",
        relevant_url=body.portfolio_url.strip() or body.linkedin_url.strip()
    )
    result = intake(request, profile)
    case_id = result["case"]["id"]
    # No fabricated match: this is a recommended screening lane, not an assignment.
    next_action = ("Review skills and portfolio; identify one relevant scoped pilot; "
                   "reply with fit or decline.")
    with database() as db:
        db.execute("""INSERT INTO collaboration_applications
            (case_id,lane,focus,skills,availability,linkedin_url,portfolio_url,
             referral_code,campaign,visitor_session,analytics_consent,contact_consent)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE)""",
            (case_id,body.lane,body.focus,body.skills.strip(),
             body.availability,body.linkedin_url.strip(),body.portfolio_url.strip(),
             body.referral_code,body.campaign,body.session_id,
             body.analytics_consent))
        db.execute("""UPDATE opportunity_cases SET next_action=%s,
                      route_basis=%s,updated_at=now() WHERE id=%s""",
            (next_action, "Candidate-selected lane "+body.lane+"; skill focus "+body.focus+
             "; recommendation only, no active job or agent handoff asserted",case_id))
        record_event(db,case_id,"collaboration.profile_received","applicant",
                     "Structured skills, availability and project proposal recorded")
    return {"received": True, "case": result["case"] | {
                "next_action": next_action, "recommended_lane": lane,
                "focus": body.focus}, "tracking_token": result["tracking_token"]}


@router.get("/api/collaborate/cases/{case_id}/track")
def collaboration_track(case_id: str, request: Request):
    return tracking(case_id, request)


class ApplicantFeedback(BaseModel):
    tracking_token: str = Field(min_length=32,max_length=200)
    rating: int = Field(ge=1,le=5)
    message: str = Field(min_length=5,max_length=1500)


@router.post("/api/collaborate/cases/{case_id}/feedback")
def collaboration_feedback(case_id: str, body: ApplicantFeedback):
    with database() as db:
        row = db.execute("""SELECT tracking_hash FROM opportunity_cases
                            WHERE id=%s AND id IN
                            (SELECT case_id FROM collaboration_applications)""",
                         (case_id,)).fetchone()
        if not row or not hmac.compare_digest(
            row["tracking_hash"],hashlib.sha256(body.tracking_token.encode()).hexdigest()):
            raise HTTPException(status_code=404, detail="NOT_FOUND")
        existing=db.execute("""SELECT count(*) n FROM collaboration_feedback
                               WHERE case_id=%s AND created_at>now()-interval '1 hour'""",
                            (case_id,)).fetchone()["n"]
        if existing >= 3:
            raise HTTPException(status_code=429, detail="FEEDBACK_LIMIT")
        db.execute("""INSERT INTO collaboration_feedback(case_id,rating,message)
                      VALUES (%s,%s,%s)""",(case_id,body.rating,body.message.strip()))
        record_event(db,case_id,"feedback.received","applicant",
                     "Rating "+str(body.rating)+"/5: "+body.message.strip())
    return {"recorded":True,"case_id":case_id}


@router.get("/api/collaborate/operator/overview",dependencies=[Depends(operator)])
def collaboration_overview():
    with database() as db:
        total=db.execute("""SELECT count(*) n FROM collaboration_applications""").fetchone()["n"]
        views=db.execute("""SELECT count(DISTINCT session_id) n FROM collaboration_events
                            WHERE event_name='page_view'""").fetchone()["n"]
        starts=db.execute("""SELECT count(DISTINCT session_id) n FROM collaboration_events
                             WHERE event_name='wizard_started'""").fetchone()["n"]
        rows=db.execute("""SELECT a.case_id,a.lane,a.focus,a.availability,a.referral_code,
                           a.campaign,a.created_at,c.status,c.stage,c.owner,c.next_action,
                           c.next_date,c.source
                           FROM collaboration_applications a
                           JOIN opportunity_cases c ON c.id=a.case_id
                           ORDER BY a.created_at DESC LIMIT 100""").fetchall()
        lanes=db.execute("""SELECT lane,count(*) n FROM collaboration_applications
                            GROUP BY lane ORDER BY n DESC""").fetchall()
        feedback=db.execute("""SELECT count(*) n,avg(rating) average
                               FROM collaboration_feedback""").fetchone()
        events=db.execute("""SELECT event_name,count(DISTINCT session_id) sessions
                             FROM collaboration_events GROUP BY event_name
                             ORDER BY sessions DESC""").fetchall()
    return {"measurement":"REAL_DATABASE_RECORDS",
            "consented_unique_view_sessions":views,
            "consented_started_sessions":starts,
            "applications":total,
            "feedback_count":feedback["n"],
            "feedback_average":float(feedback["average"]) if feedback["average"] is not None else None,
            "by_lane":[dict(x) for x in lanes],
            "events_by_type":[dict(x) for x in events],
            "recent_applications":[{
                **{k:(v.isoformat() if isinstance(v,(datetime,)) else v)
                   for k,v in x.items()}} for x in rows],
            "note":"Visitor counts cover opt-in browser events only; submissions are stored cases."}
