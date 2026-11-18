"""Tenant-scoped, non-financial participation points for WorkforceOS.

Points are not cash, crypto, service credits, airdrop allocations or a claim
against a future token. Only verified first-party actions can grant points.
No parallel payment/reputation ledger and no cross-venture claims.
"""
from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from .storage import database, event, uid

router=APIRouter(prefix="/api/rewards", tags=["Participation"])
QUIZ={"id":"agent-dna-basics-v1","question":"What does selecting a requested tool in Agent DNA Studio do?",
      "options":[{"id":"a","text":"Grants full access to connected accounts immediately"},
                 {"id":"b","text":"Records a request; actual access still requires authorized runtime permissions"},
                 {"id":"c","text":"Guarantees a successful task execution"}]}
QUESTS=[
    {"id":"daily_checkin","label":"Daily check-in","points":5,"frequency":"once_per_utc_day"},
    {"id":"first_agent","label":"Create your first real agent","points":20,"frequency":"once_per_workspace"},
    {"id":"product_feedback","label":"Share product feedback","points":10,"frequency":"once_per_utc_week"},
    {"id":"agent_basics_quiz","label":"Agent fundamentals quiz","points":15,"frequency":"once_per_workspace"},
]

class QuizAnswer(BaseModel):
    quiz_id:str=Field(min_length=5,max_length=80)
    answer_id:str=Field(pattern=r"^[a-c]$")

def initialize_rewards():
    with database() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS participation_points(
            id text PRIMARY KEY,
            workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            claim_key text NOT NULL,
            kind text NOT NULL,
            points integer NOT NULL CHECK (points>0 AND points<=100),
            source_id text,
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE(workspace_id,claim_key)
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS participation_points_owner_idx
                   ON participation_points(workspace_id,created_at DESC)""")

def award(db,tenant,*,kind,claim_key,points,source_id=None):
    """Call within the SOURCE event's DB transaction, never on an unverified UI click."""
    if not isinstance(points,int) or not 1<=points<=100:
        raise ValueError("POINTS_OUT_OF_RANGE")
    row=db.execute("""INSERT INTO participation_points
        (id,workspace_id,claim_key,kind,points,source_id)
        VALUES (%s,%s,%s,%s,%s,%s)
        ON CONFLICT (workspace_id,claim_key) DO NOTHING RETURNING id""",
        (uid("xp"),tenant,claim_key,kind,points,source_id)).fetchone()
    if row:
        event(db,tenant,"participation.earned",row["id"],kind)
    return bool(row)

def program_snapshot():
    return {"kind":"internal_participation_xp","version":"2026-11-17/v1",
            "non_transferable":True,"monetary_value":False,
            "token_or_airdrop_entitlement":False,"purchasable":False,
            "redeemable_for_paid_runtime":False,
            "quests":QUESTS,"quiz":QUIZ,
            "notice":"XP recognizes first-party participation. It is not a token, cash, stored value, discount, payment credit or promise of an airdrop."}

@router.get("/program")
def program():
    return program_snapshot()

def _auth(request:Request):
    from .main import _authentication
    return _authentication(request)

def _write_auth(request:Request):
    from .main import _authentication,_write
    return _write(request,_authentication(request))

@router.get("/me")
def me(account=Depends(_auth)):
    tenant=account["workspace_id"]
    with database() as db:
        balance=db.execute("SELECT COALESCE(sum(points),0) n FROM participation_points WHERE workspace_id=%s",
            (tenant,)).fetchone()["n"]
        entries=db.execute("""SELECT id,kind,points,source_id,created_at
            FROM participation_points WHERE workspace_id=%s ORDER BY created_at DESC LIMIT 25""",
            (tenant,)).fetchall()
    now=datetime.now(timezone.utc)
    today="daily:"+now.date().isoformat()
    week="feedback:"+now.strftime("%G-W%V")
    keys=_load_keys(tenant,[today,week,"quiz:"+QUIZ["id"],"first_agent"])
    received={x["claim_key"] for x in keys}
    return {"balance":int(balance),"currency":"XP","money":False,
            "today_claimed":today in received,
            "feedback_week_claimed":week in received,
            "quiz_claimed":"quiz:"+QUIZ["id"] in received,
            "first_agent_claimed":"first_agent" in received,
            "history":[{"id":x["id"],"kind":x["kind"],"points":x["points"],
                        "created_at":x["created_at"].isoformat()} for x in entries],
            "notice":program_snapshot()["notice"]}

def _load_keys(tenant,keys):
    with database() as db:
        return db.execute("""SELECT kind,claim_key FROM participation_points
                             WHERE workspace_id=%s AND claim_key=ANY(%s)""",(tenant,keys)).fetchall()

@router.post("/daily")
def daily(request:Request):
    account=_write_auth(request)
    tenant=account["workspace_id"]
    today=datetime.now(timezone.utc).date().isoformat()
    with database() as db:
        granted=award(db,tenant,kind="daily_checkin",claim_key="daily:"+today,points=5)
        total=db.execute("SELECT COALESCE(sum(points),0) n FROM participation_points WHERE workspace_id=%s",
                         (tenant,)).fetchone()["n"]
    return {"awarded":granted,"points":5 if granted else 0,"balance":int(total),"next":"Next UTC calendar day"}

@router.post("/quiz")
def quiz(request:Request,body:QuizAnswer):
    account=_write_auth(request)
    if body.quiz_id!=QUIZ["id"]:
        raise HTTPException(status_code=404,detail="QUIZ_NOT_FOUND")
    if body.answer_id!="b":
        return {"correct":False,"awarded":False,"points":0,"reason":"Review tool authorization and try again."}
    tenant=account["workspace_id"]
    with database() as db:
        granted=award(db,tenant,kind="agent_basics_quiz",claim_key="quiz:"+QUIZ["id"],points=15)
    return {"correct":True,"awarded":granted,"points":15 if granted else 0}
