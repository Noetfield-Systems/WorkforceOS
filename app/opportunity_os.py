"""Noetfield Opportunity OS: persistent intake and evidence-led routing.

A module inside the existing WorkforceOS deployment. It owns only relationship
case records; it neither registers agents nor dispatches tasks or claims receipts.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from .storage import database, auth_rate_limit, email_normalize

router = APIRouter()
KINDS = {
    "customer": ("مسیر مشتری / پایلوت", "متخصص فروش و کشف نیاز", "Workflow OS / مسئول محصول"),
    "partnership": ("مسیر شراکت", "مدیر توسعه همکاری", "Company OS / مشارکت انسانی"),
    "investment": ("مسیر سرمایه‌گذار", "مسئول استراتژی و جذب سرمایه", "Sina Founder OS / بررسی Founder"),
    "recruiting": ("مسیر جذب و همکاری", "متخصص تطبیق مهارت", "WorkforceOS / همکاری انسانی"),
    "referral": ("مسیر معرفی و ارجاع", "مدیر ارتباطات و رشد", "Company OS / فرصت تجاری"),
    "grant": ("مسیر گرنت و برنامه", "متخصص گرنت و توسعه کسب‌وکار", "Sina Founder OS / استراتژی"),
    "agent_work": ("مسیر اجرای AI", "معمار Workflow و عامل متخصص", "Agent OS / Workflow OS"),
    "community": ("مسیر اکوسیستم", "مدیر جامعه و روابط", "WorkFeed / هماهنگ‌کننده انسانی"),
    "other": ("بازبینی عمومی", "مسئول ارزیابی فرصت", "Company OS / صف بررسی"),
}
SOURCES = {"linkedin","referral","email","event","website","community","direct","other"}
STAGES = {"received","qualifying","matched","handoff","executing","follow_up","converted","closed"}
STATUSES = {"new","in_review","waiting_reply","active","won","lost","archived"}
COLLAB = {"not_started","suggested","contacted","mutual_interest","handoff_recorded","in_progress","completed"}
MATCH = {"not_assessed","low","medium","high"}
OUTCOMES = {"none","introduction","customer","partner","recruit","investor","grant","shipped_work","other"}
NOTE_KINDS = {"note","qualification","matching","handoff","feedback","evidence","follow_up"}
EVIDENCE_RE = re.compile(r"^https://[^\s]{6,1600}$")


def initialize_opportunities():
    with database() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS opportunity_cases (
            id text PRIMARY KEY,
            tracking_hash text NOT NULL,
            full_name text NOT NULL, email text NOT NULL, organization text NOT NULL DEFAULT '',
            source text NOT NULL, source_url text NOT NULL DEFAULT '',
            source_context text NOT NULL DEFAULT '',
            kind text NOT NULL, intent text NOT NULL,
            venture text NOT NULL DEFAULT 'unspecified',
            participant text NOT NULL DEFAULT 'human',
            relevant_url text NOT NULL DEFAULT '',
            proposed_route text NOT NULL, suggested_specialist text NOT NULL,
            integration_lane text NOT NULL, route_basis text NOT NULL,
            owner text NOT NULL DEFAULT 'intake_queue',
            status text NOT NULL DEFAULT 'new',
            stage text NOT NULL DEFAULT 'received',
            collaboration text NOT NULL DEFAULT 'not_started',
            match_quality text NOT NULL DEFAULT 'not_assessed',
            next_action text NOT NULL, next_date date,
            assignment_reference text NOT NULL DEFAULT '',
            outcome text NOT NULL DEFAULT 'none',
            outcome_evidence text NOT NULL DEFAULT '',
            verification_reference text NOT NULL DEFAULT '',
            verification_state text NOT NULL DEFAULT 'NOT_INDEPENDENTLY_VERIFIED',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )""")
        # Additive source key: native WorkforceOS cases keep their own primary ID.
        # A partial unique index prevents duplicate imports across concurrent retries.
        db.execute("ALTER TABLE opportunity_cases ADD COLUMN IF NOT EXISTS source_intake_id text NOT NULL DEFAULT ''")
        db.execute("ALTER TABLE opportunity_cases ADD COLUMN IF NOT EXISTS source_request_id text NOT NULL DEFAULT ''")
        db.execute("""CREATE UNIQUE INDEX IF NOT EXISTS opportunities_canonical_source_idx
                      ON opportunity_cases(source_intake_id) WHERE source_intake_id <> ''""")
        db.execute("""CREATE INDEX IF NOT EXISTS opportunities_created_idx
                      ON opportunity_cases(created_at DESC)""")
        db.execute("""CREATE INDEX IF NOT EXISTS opportunities_next_idx
                      ON opportunity_cases(next_date,status)""")
        db.execute("""CREATE TABLE IF NOT EXISTS opportunity_events (
            id bigserial PRIMARY KEY,
            case_id text NOT NULL REFERENCES opportunity_cases(id) ON DELETE CASCADE,
            event_type text NOT NULL,
            actor text NOT NULL,
            body text NOT NULL DEFAULT '',
            evidence_url text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS opportunities_events_idx
                      ON opportunity_events(case_id,id DESC)""")


class Intake(BaseModel):
    full_name: str = Field(min_length=2,max_length=120)
    email: str = Field(min_length=5,max_length=254)
    organization: str = Field(default="",max_length=140)
    source: str = Field(min_length=3,max_length=40)
    source_url: str = Field(default="",max_length=1500)
    source_context: str = Field(min_length=10,max_length=3000)
    kind: str = Field(min_length=3,max_length=40)
    intent: str = Field(min_length=20,max_length=4500)
    venture: str = Field(default="unspecified",max_length=80)
    participant: Literal["human","ai","hybrid"] = "human"
    relevant_url: str = Field(default="",max_length=1500)
    website: str = Field(default="",max_length=150)  # honeypot


class UpdateCase(BaseModel):
    owner: str | None = Field(default=None,max_length=140)
    status: str | None = None
    stage: str | None = None
    collaboration: str | None = None
    match_quality: str | None = None
    next_action: str | None = Field(default=None,max_length=2000)
    next_date: date | None = None
    assignment_reference: str | None = Field(default=None,max_length=1500)
    outcome: str | None = None
    outcome_evidence: str | None = Field(default=None,max_length=1500)
    verification_reference: str | None = Field(default=None,max_length=1500)


class EventInput(BaseModel):
    event_type: str
    body: str = Field(min_length=3,max_length=3000)
    evidence_url: str = Field(default="",max_length=1500)


FIELDS = ("id","full_name","email","organization","source","source_url",
          "source_context","kind","intent","venture","participant","relevant_url",
          "proposed_route","suggested_specialist","integration_lane","route_basis",
          "owner","status","stage","collaboration","match_quality","next_action",
          "next_date","assignment_reference","outcome","outcome_evidence",
          "verification_reference","verification_state","created_at","updated_at")
PUBLIC_FIELDS = ("id","kind","proposed_route","suggested_specialist",
                 "integration_lane","route_basis","status","stage",
                 "next_action","next_date","created_at")


def serialize(row, fields=FIELDS):
    return {key:(v.isoformat() if isinstance(v,(date,datetime)) else v)
            for key in fields if (v := row.get(key)) is not None or key in row}


def operator(request: Request):
    configured = os.environ.get("OPPORTUNITY_OPERATOR_KEY","")
    supplied = request.headers.get("X-Opportunity-Operator-Key","")
    if len(configured)<32 or not hmac.compare_digest(configured,supplied):
        raise HTTPException(status_code=403,detail="OPERATOR_ACCESS_DENIED")
    return True


def valid_url(value: str):
    return not value or bool(EVIDENCE_RE.fullmatch(value))


def record_event(db, case_id, event_type, actor, body="", evidence_url=""):
    db.execute("""INSERT INTO opportunity_events(case_id,event_type,actor,body,evidence_url)
                  VALUES (%s,%s,%s,%s,%s)""",
               (case_id,event_type,actor,body,evidence_url))


@router.post("/api/opportunity-os/cases",status_code=201)
def intake(request: Request, body: Intake):
    if body.website.strip():
        return {"received":True}  # bot submission ignored, no case asserted
    if body.kind not in KINDS or body.source not in SOURCES:
        raise HTTPException(status_code=422,detail="INVALID_CATEGORY_OR_SOURCE")
    if not all(valid_url(u) for u in (body.source_url,body.relevant_url)):
        raise HTTPException(status_code=422,detail="HTTPS_LINK_REQUIRED")
    try:
        email = email_normalize(body.email)
    except ValueError:
        raise HTTPException(status_code=422,detail="INVALID_EMAIL")
    ip = request.client.host if request.client else "unknown"
    bucket = hashlib.sha256(("opportunity|"+ip+"|"+email).encode()).hexdigest()
    with database() as db:
        permitted=auth_rate_limit(db,"opp:"+bucket,threshold=5)
    if not permitted:
        raise HTTPException(status_code=429,detail="TOO_MANY_REQUESTS")
    label, specialist, lane = KINDS[body.kind]
    case_id = "opp_" + secrets.token_hex(12)
    tracking_token = secrets.token_urlsafe(32)
    route_basis = "پیشنهاد مبتنی بر نوع فرصت اعلام‌شده؛ هنوز ارزیابی و انتساب واقعی انجام نشده است."
    # An intake is never auto-assigned to a real human or AI agent.
    next_action = "ارزیابی شواهد و تناسب فرصت توسط مسئول ورودی"
    next_date = datetime.now(timezone.utc).date()+timedelta(days=1)
    while next_date.weekday() >= 5:
        next_date += timedelta(days=1)
    with database() as db:
        db.execute("""INSERT INTO opportunity_cases
            (id,tracking_hash,full_name,email,organization,source,source_url,
             source_context,kind,intent,venture,participant,relevant_url,proposed_route,
             suggested_specialist,integration_lane,route_basis,next_action,owner,next_date)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""", 
            (case_id,hashlib.sha256(tracking_token.encode()).hexdigest(),
             body.full_name.strip(),email,body.organization.strip(),body.source,
             body.source_url.strip(),body.source_context.strip(),body.kind,
             body.intent.strip(),body.venture.strip(),body.participant,
             body.relevant_url.strip(),label,specialist,lane,route_basis,next_action,
             'intake_queue',next_date))
        record_event(db,case_id,"intake.received","applicant","دریافت واقعی درخواست؛ بدون انتساب یا اجرای خودکار")
    return {"received":True,"case": {"id":case_id,"kind":body.kind,
            "route":label,"specialist":specialist,"integration_lane":lane,
            "status":"new","stage":"received","owner":"intake_queue",
            "next_action":next_action,"next_date":next_date.isoformat(),
            "verification_state":"NOT_INDEPENDENTLY_VERIFIED"},
            "tracking_token":tracking_token}


@router.get("/api/opportunity-os/cases/{case_id}/track")
def tracking(case_id: str, request: Request):
    token = request.headers.get("X-Opportunity-Tracking-Token","")
    if len(token)<32 or len(token)>200:
        raise HTTPException(status_code=404,detail="NOT_FOUND")
    with database() as db:
        row=db.execute("""SELECT * FROM opportunity_cases WHERE id=%s""",(case_id,)).fetchone()
    if not row or not hmac.compare_digest(row["tracking_hash"],
                                          hashlib.sha256(token.encode()).hexdigest()):
        raise HTTPException(status_code=404,detail="NOT_FOUND")
    result=serialize(row,PUBLIC_FIELDS)
    result["verification_state"]="NOT_INDEPENDENTLY_VERIFIED"  # no verifier integration
    return {"case":result}


@router.get("/api/opportunity-os/operator/cases",dependencies=[Depends(operator)])
def cases(status: str="",kind: str="",source: str="",owner: str="",
          stage: str="",match_quality: str="",collaboration: str="",
          outcome: str="",due: str="",q: str="",limit: int=100):
    for val,allowed in ((status,STATUSES),(kind,KINDS),(source,SOURCES),
                        (stage,STAGES),(match_quality,MATCH),(collaboration,COLLAB),
                        (outcome,OUTCOMES)):
        if val and val not in allowed:
            raise HTTPException(status_code=422,detail="INVALID_FILTER")
    if due not in ("","overdue","today","week","scheduled","none"):
        raise HTTPException(status_code=422,detail="INVALID_DUE_FILTER")
    if limit<1 or limit>200 or len(q)>100 or len(owner)>140:
        raise HTTPException(status_code=422,detail="INVALID_FILTER")
    conditions=["TRUE"];values=[]
    for key,val in (("status",status),("kind",kind),("source",source),
                    ("stage",stage),("match_quality",match_quality),
                    ("collaboration",collaboration),("outcome",outcome)):
        if val:
            conditions.append(key+"=%s"); values.append(val)
    if owner:
        conditions.append("owner ILIKE %s");values.append("%"+owner+"%")
    if due:
        conditions.append({"overdue":"next_date < CURRENT_DATE",
                           "today":"next_date = CURRENT_DATE",
                           "week":"next_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7",
                           "scheduled":"next_date IS NOT NULL",
                           "none":"next_date IS NULL"}[due])
    if q:
        conditions.append("(full_name ILIKE %s OR organization ILIKE %s OR intent ILIKE %s OR id ILIKE %s OR next_action ILIKE %s)")
        values.extend(["%"+q+"%"]*5)
    with database() as db:
        rows=db.execute("SELECT * FROM opportunity_cases WHERE "+" AND ".join(conditions)+
                        " ORDER BY created_at DESC LIMIT %s",(*values,limit)).fetchall()
        totals=db.execute("""SELECT status,count(*) AS total FROM opportunity_cases
                             GROUP BY status""").fetchall()
    return {"cases":[serialize(x) for x in rows],
            "totals":{x["status"]:x["total"] for x in totals},
            "returned":len(rows),"dataset":"REAL_STORED_CASES_ONLY"}


@router.get("/api/opportunity-os/operator/cases/{case_id}",dependencies=[Depends(operator)])
def case_detail(case_id: str):
    with database() as db:
        row=db.execute("SELECT * FROM opportunity_cases WHERE id=%s",(case_id,)).fetchone()
        if not row:raise HTTPException(status_code=404,detail="NOT_FOUND")
        history=db.execute("""SELECT id,event_type,actor,body,evidence_url,created_at
                              FROM opportunity_events WHERE case_id=%s
                              ORDER BY id DESC LIMIT 150""",(case_id,)).fetchall()
    return {"case":serialize(row),"events":[serialize(e,tuple(e.keys())) for e in history]}


@router.patch("/api/opportunity-os/operator/cases/{case_id}",dependencies=[Depends(operator)])
def update_case(case_id: str, body: UpdateCase):
    patch=body.model_dump(exclude_unset=True)
    for field, options in (("status",STATUSES),("stage",STAGES),
                           ("collaboration",COLLAB),("match_quality",MATCH),
                           ("outcome",OUTCOMES)):
        if field in patch and patch[field] not in options:
            raise HTTPException(status_code=422,detail="INVALID_"+field.upper())
    for field in ("assignment_reference","outcome_evidence","verification_reference"):
        if field in patch and patch[field] and not valid_url(patch[field]):
            raise HTTPException(status_code=422,detail="HTTPS_EVIDENCE_LINK_REQUIRED")
    if "next_action" in patch and not str(patch["next_action"] or "").strip():
        raise HTTPException(status_code=422,detail="NEXT_ACTION_REQUIRED")
    if not patch:
        raise HTTPException(status_code=422,detail="NO_CHANGES")
    # Never grant VERIFIED by changing a label. A supplied receipt URL is unverified metadata
    # until the existing independent source verifier confirms it.
    allowed={"owner","status","stage","collaboration","match_quality","next_action",
             "next_date","assignment_reference","outcome","outcome_evidence",
             "verification_reference"}
    if not set(patch)<=allowed:
        raise HTTPException(status_code=422,detail="INVALID_FIELD")
    with database() as db:
        existing=db.execute("SELECT * FROM opportunity_cases WHERE id=%s FOR UPDATE",
                            (case_id,)).fetchone()
        if not existing:raise HTTPException(status_code=404,detail="NOT_FOUND")
        new={k:v for k,v in patch.items() if existing[k]!=v}
        if not new:return {"case":serialize(existing),"changed":[]}
        target_outcome=new.get("outcome",existing["outcome"])
        target_evidence=new.get("outcome_evidence",existing["outcome_evidence"])
        target_status=new.get("status",existing["status"])
        if target_outcome!="none" and not target_evidence:
            raise HTTPException(status_code=422,detail="OUTCOME_EVIDENCE_REQUIRED")
        if new.get("collaboration") in ("handoff_recorded","in_progress","completed") and not (new.get("assignment_reference") or existing["assignment_reference"]):
            raise HTTPException(status_code=422,detail="EXTERNAL_HANDOFF_REFERENCE_REQUIRED")
        if target_status=="won" and target_outcome=="none":
            raise HTTPException(status_code=422,detail="WON_REQUIRES_RECORDED_OUTCOME")
        if new.get("stage")=="converted" and target_outcome=="none":
            raise HTTPException(status_code=422,detail="CONVERSION_OUTCOME_REQUIRED")
        sql="UPDATE opportunity_cases SET "+",".join(k+"=%s" for k in new)+",updated_at=now() WHERE id=%s RETURNING *"
        row=db.execute(sql,(*new.values(),case_id)).fetchone()
        record_event(db,case_id,"case.updated","authorized_operator",
                     "تغییر واقعی فیلدها: "+", ".join(new.keys()))
    return {"case":serialize(row),"changed":list(new),
            "independently_verified":False}


@router.post("/api/opportunity-os/operator/cases/{case_id}/events",dependencies=[Depends(operator)])
def add_event(case_id: str, body: EventInput):
    if body.event_type not in NOTE_KINDS or not valid_url(body.evidence_url):
        raise HTTPException(status_code=422,detail="INVALID_EVENT")
    with database() as db:
        exists=db.execute("SELECT id FROM opportunity_cases WHERE id=%s",(case_id,)).fetchone()
        if not exists:raise HTTPException(status_code=404,detail="NOT_FOUND")
        record_event(db,case_id,body.event_type,"authorized_operator",
                     body.body.strip(),body.evidence_url.strip())
    return {"recorded":True,"independently_verified":False}
