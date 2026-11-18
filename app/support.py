"""WorkforceOS customer care: persistent cases, receipt lookup and OS event outbox.

The queue is an integration seam, not a claim that an autonomous repair worker
is connected. Agents may read and acknowledge events using an operator key;
no user text is ever executed as code or treated as authorization.
"""
from __future__ import annotations
import hashlib
import hmac
import os
import secrets
from urllib.parse import urlsplit
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from .storage import database, uid, email_normalize, account_for_session, auth_rate_limit
from . import billing

router=APIRouter(prefix="/api/support", tags=["Customer care"])
CATEGORIES={"bug","billing","agent","account","referral","feature",
            "community","partnership","capital","other"}
GUIDANCE={
 "bug":"Try a hard refresh and include the exact route, device and steps to reproduce.",
 "billing":"Review /pricing and workspace billing. Never share card details in a ticket.",
 "agent":"Open Agent Studio and inspect the task state before submitting the task ID.",
 "account":"Check the email you used to register; do not send your password.",
 "referral":"Your invitation is rewarded only after the referred member activates an Agent.",
 "feature":"Describe the intended outcome and the page that needs improvement.",
 "community":"Explore Genesis daily claims, quests and the member leaderboard.",
 "partnership":"Describe your contribution, audience and preferred collaboration.",
 "capital":"Share your interest or questions; no WorkforceOS token sale or investment subscription is open.",
 "other":"Tell us what you tried and what outcome you expected."
}

def initialize_support():
    with database() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS support_cases(
            id text PRIMARY KEY,
            workspace_id text REFERENCES workspaces(id) ON DELETE SET NULL,
            email text NOT NULL, name text NOT NULL,
            category text NOT NULL, subject text NOT NULL, message text NOT NULL,
            page_path text NOT NULL DEFAULT '/',
            receipt_hash text NOT NULL,
            status text NOT NULL DEFAULT 'RECEIVED',
            priority text NOT NULL DEFAULT 'NORMAL',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS support_cases_created_idx
                   ON support_cases(created_at DESC)""")
        db.execute("""CREATE TABLE IF NOT EXISTS support_case_events(
            id bigserial PRIMARY KEY,
            case_id text NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
            kind text NOT NULL,
            state text NOT NULL DEFAULT 'QUEUED',
            note text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS support_events_queue_idx
                   ON support_case_events(state,created_at)""")
        db.execute("""CREATE TABLE IF NOT EXISTS support_case_messages(
            id bigserial PRIMARY KEY, case_id text NOT NULL
                 REFERENCES support_cases(id) ON DELETE CASCADE,
            author text NOT NULL CHECK(author IN ('customer','support')),
            body text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS support_case_messages_idx
                   ON support_case_messages(case_id,id)""")

class CaseInput(BaseModel):
    name:str=Field(min_length=2,max_length=100)
    email:str=Field(min_length=5,max_length=254)
    category:str=Field(min_length=3,max_length=30)
    subject:str=Field(min_length=5,max_length=140)
    message:str=Field(min_length=15,max_length=3500)
    page_path:str=Field(default="/",max_length=240)
    website:str=Field(default="",max_length=240)

class OperatorUpdate(BaseModel):
    status:str=Field(min_length=3,max_length=25)
    note:str=Field(default="",max_length=600)
    customer_visible:bool=False

class CustomerReply(BaseModel):
    message:str=Field(min_length=8,max_length=2000)

def _operator(request:Request):
    key=os.getenv("WORKFORCE_SUPPORT_OPERATOR_KEY","")
    supplied=request.headers.get("X-Workforce-Support-Key","")
    if len(key)<32 or not hmac.compare_digest(key,supplied):
        raise HTTPException(404,"NOT_FOUND")

@router.get("/config")
def config():
    available=billing._ready()
    return {"support":"available","case_tracking":True,
            "assistant":"guided_self_service_not_live_chat",
            "os_queue":"operator_polling_ready_not_autonomous_repair",
            "plans":{"free":0,**billing.PLANS},
            "currency":"USD","billing_interval":"month",
            "stripe_checkout_ready":available,
            "crypto_checkout_ready":False,"token_sale_active":False,
            "staking_real_value":False,"financial_offering_active":False}

@router.post("/cases",status_code=201)
def create_case(request:Request,body:CaseInput):
    if body.website.strip():
        return {"received":True}
    if body.category not in CATEGORIES:
        raise HTTPException(400,"INVALID_CATEGORY")
    try:
        email=email_normalize(body.email)
    except ValueError:
        raise HTTPException(400,"INVALID_EMAIL")
    path=urlsplit(body.page_path).path
    if not path.startswith("/") or path.startswith("//") or "\\" in path:
        path="/"
    ip=request.client.host if request.client else "unknown"
    bucket="support:"+hashlib.sha256((ip+"|"+email).encode()).hexdigest()
    ip_bucket="support_ip:"+hashlib.sha256(ip.encode()).hexdigest()
    # Separate committed limiter transaction; changing emails cannot evade IP limits.
    with database() as db:
        ip_allowed=auth_rate_limit(db,ip_bucket,threshold=30)
        sender_allowed=auth_rate_limit(db,bucket,threshold=5)
    if not ip_allowed or not sender_allowed:
        raise HTTPException(429,"TOO_MANY_SUPPORT_REQUESTS")
    token=secrets.token_urlsafe(32)
    case_id=uid("sup")
    severity="HIGH" if body.category in {"bug","billing","account"} else "NORMAL"
    with database() as db:
        session=account_for_session(db,request.cookies.get("workforce_session"))
        workspace=session["workspace_id"] if session else None
        db.execute("""INSERT INTO support_cases
           (id,workspace_id,email,name,category,subject,message,page_path,
            receipt_hash,priority)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
           (case_id,workspace,email,body.name.strip(),body.category,
            body.subject.strip(),body.message.strip(),path,
            hashlib.sha256(token.encode()).hexdigest(),severity))
        db.execute("""INSERT INTO support_case_events(case_id,kind,note)
                  VALUES (%s,%s,%s)""",(case_id,"support.case_created",
                   "Source: first-party customer care; classify and route"))
    return {"received":True,"id":case_id,"receipt":token,"status":"RECEIVED",
            "triage":"QUEUED","guidance":GUIDANCE[body.category]}

@router.get("/cases/{case_id}")
def case_status(case_id:str,request:Request):
    token=request.headers.get("X-Support-Receipt","")
    if not case_id.startswith("sup_") or len(token)<32:
        raise HTTPException(404,"CASE_NOT_FOUND")
    with database() as db:
        row=db.execute("""SELECT id,receipt_hash,status,category,created_at,updated_at
            FROM support_cases WHERE id=%s""",(case_id,)).fetchone()
    if not row or not hmac.compare_digest(row["receipt_hash"],
                                          hashlib.sha256(token.encode()).hexdigest()):
        raise HTTPException(404,"CASE_NOT_FOUND")
    with database() as db:
        messages=db.execute("""SELECT author,body,created_at FROM support_case_messages
                   WHERE case_id=%s ORDER BY id DESC LIMIT 25""",(case_id,)).fetchall()
    return {"id":row["id"],"status":row["status"],"category":row["category"],
            "created_at":row["created_at"].isoformat(),
            "updated_at":row["updated_at"].isoformat(),
            "messages":[{"author":m["author"],"body":m["body"],
                         "created_at":m["created_at"].isoformat()} for m in reversed(messages)]}

@router.post("/cases/{case_id}/reply",status_code=201)
def customer_reply(case_id:str,request:Request,body:CustomerReply):
    token=request.headers.get("X-Support-Receipt","")
    if not case_id.startswith("sup_") or len(token)<32:
        raise HTTPException(404,"CASE_NOT_FOUND")
    with database() as db:
        row=db.execute("SELECT receipt_hash FROM support_cases WHERE id=%s",(case_id,)).fetchone()
    if not row or not hmac.compare_digest(row["receipt_hash"],
                                          hashlib.sha256(token.encode()).hexdigest()):
        raise HTTPException(404,"CASE_NOT_FOUND")
    with database() as db:
        if not auth_rate_limit(db,"support_reply:"+case_id,threshold=12):
            raise HTTPException(429,"TOO_MANY_REPLIES")
    with database() as db:
        db.execute("""INSERT INTO support_case_messages(case_id,author,body)
                      VALUES (%s,'customer',%s)""",(case_id,body.message.strip()))
        db.execute("UPDATE support_cases SET status='RECEIVED',updated_at=now() WHERE id=%s",(case_id,))
        db.execute("""INSERT INTO support_case_events(case_id,kind,note)
                  VALUES (%s,'support.customer_replied',%s)""",(case_id,body.message.strip()[:600]))
    return {"received":True,"id":case_id,"status":"RECEIVED"}

@router.get("/operator/queue")
def operator_queue(request:Request):
    _operator(request)
    with database() as db:
        rows=db.execute("""SELECT e.id AS event_id,e.kind,e.state,e.note AS event_note,e.created_at,
                c.id AS case_id,c.category,c.subject,c.message,c.page_path,
                c.priority,c.status,c.email,c.name,c.workspace_id
                FROM support_case_events e JOIN support_cases c ON c.id=e.case_id
                WHERE e.state='QUEUED' ORDER BY e.created_at ASC LIMIT 100""").fetchall()
    return {"events":[{**dict(row),"created_at":row["created_at"].isoformat()} for row in rows],
            "connection":"polling_endpoint","auto_repair_enabled":False}

@router.post("/operator/events/{event_id}")
def operator_update(event_id:int,request:Request,body:OperatorUpdate):
    _operator(request)
    if body.status not in {"ACKNOWLEDGED","INVESTIGATING","NEEDS_HUMAN","RESOLVED"}:
        raise HTTPException(400,"INVALID_STATUS")
    with database() as db:
        row=db.execute("""UPDATE support_case_events SET state='HANDLED',
                      note=%s,updated_at=now() WHERE id=%s AND state='QUEUED'
                      RETURNING case_id""",(body.note.strip(),event_id)).fetchone()
        if not row:raise HTTPException(404,"EVENT_NOT_QUEUED")
        db.execute("""UPDATE support_cases SET status=%s,updated_at=now()
                       WHERE id=%s""",(body.status,row["case_id"]))
        if body.customer_visible and body.note.strip():
            db.execute("""INSERT INTO support_case_messages(case_id,author,body)
                          VALUES (%s,'support',%s)""",(row["case_id"],body.note.strip()))
    return {"ok":True,"case_id":row["case_id"],"status":body.status}
