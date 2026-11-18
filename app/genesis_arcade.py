"""Genesis member arcade and demonstrator economy.

The only earned rewards are real INTERNAL XP grants via participation_points.
The purchase/stake/invest screens use a separate, zero-value sandbox.
No financial assets, yield, custody, crypto minting or token claims occur.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from .storage import database, event, uid
from . import rewards

router=APIRouter(prefix="/api/genesis",tags=["Genesis Arcade"])
RATE=10
DEMO_CREDITS=1000
DEMO_UNITS=100
PROGRAMS={
    "agent_creators":"Agent creator ecosystem (fictional)",
    "community_growth":"Community initiatives (fictional)",
    "infrastructure":"Runtime infrastructure (fictional)"
}
CHALLENGES=[
 ("Which WorkforceOS specialist fits a community onboarding project?",
  ["Echo — Community Experience","Sable — Operations","Vesper — Historical Research","Milo — Engineering"],0,
  "Echo focuses on onboarding, feedback and meaningful member engagement."),
 ("What does saving Agent DNA mean?",
  ["A live crypto mint","A workspace-owned specialist configuration","Guaranteed task completion","Unlimited external tool permissions"],1,
  "Agent DNA saves the configuration; execution still requires permitted runtime access."),
 ("Which activity qualifies a referral for XP?",
  ["Clicking a referral link","Registering any new account","The referred workspace saves its first Agent DNA","Reposting a token screenshot"],2,
  "The first real Agent DNA creation activates a referred workspace."),
 ("What is a verified Agent task output?",
  ["A photo of a dashboard","A claim on social media","A guaranteed return forecast","A source-linked task result that can be reviewed"],3,
  "A task needs a real output and provenance; decorative screenshots are not execution proof."),
 ("Which agent is best for structured historical source analysis?",
  ["Vesper","Echo","Milo","Lyra"],0,
  "Vesper specializes in research context, evidence and synthesis."),
 ("What happens when you select a model provider in Agent Studio?",
  ["Free payment credits are minted","Your request is recorded, subject to actual runtime authorization","Private credentials are instantly granted","The task automatically finishes"],1,
  "The requested provider is metadata until an authorized runtime route accepts it."),
 ("What does Genesis XP represent today?",
  ["A future token allocation","Cash you can withdraw","Non-transferable internal participation history","An interest-bearing stake"],2,
  "Season Zero awards participation XP, not a transferable or monetary asset.")
]

def initialize_arcade():
    with database() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS genesis_sandbox_wallets (
           workspace_id text PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
           credits integer NOT NULL DEFAULT 1000 CHECK (credits>=0),
           units integer NOT NULL DEFAULT 100 CHECK (units>=0),
           staked_units integer NOT NULL DEFAULT 0 CHECK (staked_units>=0),
           started_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS genesis_sandbox_positions (
           id text PRIMARY KEY,
           workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
           category text NOT NULL,
           units integer NOT NULL CHECK (units>0),
           unlock_at timestamptz,
           closed_at timestamptz,
           created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS genesis_sandbox_positions_owner_idx
           ON genesis_sandbox_positions(workspace_id,created_at DESC)""")
        db.execute("""CREATE TABLE IF NOT EXISTS genesis_sandbox_operations (
           id text PRIMARY KEY,
           workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
           request_id text NOT NULL,
           action text NOT NULL,
           amount integer NOT NULL,
           category text,
           created_at timestamptz NOT NULL DEFAULT now(),
           UNIQUE(workspace_id,request_id)
        )""")

def _auth(request:Request):
    from .main import _authentication
    return _authentication(request)

def _write(request:Request):
    from .main import _authentication,_write as verify
    return verify(request,_authentication(request))

def _today():
    now=datetime.now(timezone.utc)
    return now.date().isoformat()

def _challenge():
    # Consistent for the UTC day across requests. Deterministic correctness
    # is validated only server-side; the client receives no answer key.
    index=datetime.now(timezone.utc).date().toordinal()%len(CHALLENGES)
    question,answers,correct,reason=CHALLENGES[index]
    return {"id":_today(),"question":question,"choices":[
        {"id":str(i),"text":answer} for i,answer in enumerate(answers)
    ]},correct,reason

def _joined(db,workspace):
    return bool(db.execute("""SELECT 1 FROM genesis_memberships
        WHERE workspace_id=%s AND season_id='season-zero'""",(workspace,)).fetchone())

@router.get("/play/today")
def play_today(account=Depends(_auth)):
    tenant=account["workspace_id"]
    challenge,_,_=_challenge()
    with database() as db:
        done=bool(db.execute("""SELECT 1 FROM participation_points
            WHERE workspace_id=%s AND claim_key=%s""",
            (tenant,"genesis:play:"+challenge["id"])).fetchone())
        joined=_joined(db,tenant)
    return {**challenge,"played":done,"joined":joined,"reward_xp":8,
            "next_reset":"00:00 UTC","game":"Specialist Match",
            "notice":"One real internal XP award per UTC day; no token or monetary reward."}

class Answer(BaseModel):
    challenge_id:str=Field(min_length=10,max_length=12)
    choice_id:str=Field(pattern=r"^[0-3]$")

@router.post("/play/answer")
def play_answer(body:Answer,request:Request):
    account=_write(request)
    tenant=account["workspace_id"]
    challenge,correct,reason=_challenge()
    if body.challenge_id!=challenge["id"]:
        raise HTTPException(status_code=409,detail="DAILY_CHALLENGE_EXPIRED")
    valid=body.choice_id==str(correct)
    if not valid:
        return {"correct":False,"awarded":False,"xp":0,
                "feedback":"Try another specialist. The correct answer has not been revealed."}
    with database() as db:
        if not _joined(db,tenant):
            raise HTTPException(status_code=409,detail="JOIN_GENESIS_FIRST")
        granted=rewards.award(db,tenant,kind="genesis_daily_game",
            claim_key="genesis:play:"+challenge["id"],points=8,
            source_id=challenge["id"])
    return {"correct":True,"awarded":granted,"xp":8 if granted else 0,
            "feedback":reason,"next_reset":"00:00 UTC"}

def get_streak(db,workspace):
    rows=db.execute("""SELECT claim_key FROM participation_points
        WHERE workspace_id=%s AND kind='daily_checkin'
          AND created_at >= now()-interval '120 days'
        ORDER BY created_at DESC LIMIT 120""",(workspace,)).fetchall()
    days=set(x["claim_key"] for x in rows)
    now=datetime.now(timezone.utc).date()
    if "daily:"+now.isoformat() not in days:
        now=now-timedelta(days=1)
    count=0
    for i in range(120):
        if "daily:"+(now-timedelta(days=i)).isoformat() not in days:break
        count+=1
    return count

def streak_award(db,tenant):
    streak=get_streak(db,tenant)
    if not _joined(db,tenant):
        return streak,0
    # Milestone bonuses only (never APY or compounding financial yield).
    bonus=10 if streak>=7 and streak%7==0 else 4 if streak>=3 and streak%7==3 else 0
    if bonus:
        rewards.award(db,tenant,kind="daily_streak_bonus",
            claim_key="genesis:streak:"+_today(),points=bonus,
            source_id=_today())
    return streak,bonus

@router.get("/daily-state")
def daily_state(account=Depends(_auth)):
    tenant=account["workspace_id"]
    with database() as db:
        streak=get_streak(db,tenant)
        today=bool(db.execute("""SELECT 1 FROM participation_points
              WHERE workspace_id=%s AND claim_key=%s""",
              (tenant,"daily:"+_today())).fetchone())
    return {"streak_days":streak,"claimed_today":today,"next_reset":"00:00 UTC",
            "streak_bonus_at":[3,7],"bonus_xp":[4,10]}

def _public_wallet(db,tenant):
    wallet=db.execute("""SELECT credits,units,staked_units,started_at
        FROM genesis_sandbox_wallets WHERE workspace_id=%s""",(tenant,)).fetchone()
    if not wallet:
        return {"started":False,"credits":0,"units":0,"staked_units":0,
                "positions":[],"history":[],"virtual_unit_cost":RATE,
                "virtual_not_tradeable":True,"not_redeemable":True}
    positions=db.execute("""SELECT id,category,units,unlock_at,closed_at,created_at
          FROM genesis_sandbox_positions
          WHERE workspace_id=%s ORDER BY created_at DESC LIMIT 50""",
          (tenant,)).fetchall()
    ops=db.execute("""SELECT action,amount,category,created_at
          FROM genesis_sandbox_operations
          WHERE workspace_id=%s ORDER BY created_at DESC LIMIT 30""",
          (tenant,)).fetchall()
    return {"started":True,"credits":wallet["credits"],"units":wallet["units"],
            "staked_units":wallet["staked_units"],"virtual_unit_cost":RATE,
            "virtual_not_tradeable":True,"not_redeemable":True,
            "positions":[{"id":x["id"],"category":x["category"],"units":x["units"],
                         "unlock_at":x["unlock_at"].isoformat() if x["unlock_at"] else None,
                         "closed":x["closed_at"] is not None} for x in positions],
            "history":[{"action":x["action"],"amount":x["amount"],
                        "category":x["category"],"created_at":x["created_at"].isoformat()}
                       for x in ops],
            "notice":"100% fictional sandbox. Demo Credits and DEMO units are not assets, payments, tokens, deposits, investments, or rewards."}

@router.get("/sandbox")
def sandbox(account=Depends(_auth)):
    with database() as db:return _public_wallet(db,account["workspace_id"])

@router.post("/sandbox/start")
def sandbox_start(request:Request):
    account=_write(request)
    tenant=account["workspace_id"]
    with database() as db:
        if not _joined(db,tenant):
            raise HTTPException(status_code=409,detail="JOIN_GENESIS_FIRST")
        row=db.execute("""INSERT INTO genesis_sandbox_wallets(workspace_id)
            VALUES (%s) ON CONFLICT DO NOTHING RETURNING workspace_id""",
            (tenant,)).fetchone()
        if row:event(db,tenant,"genesis.sandbox_started",tenant)
        state=_public_wallet(db,tenant)
    return {"new":bool(row),**state}

class SandboxOperation(BaseModel):
    action:str=Field(pattern=r"^(buy|sell|stake|unstake|invest)$")
    amount:int=Field(ge=1,le=500)
    category:str|None=Field(default=None,max_length=50)
    request_id:str=Field(pattern=r"^[a-zA-Z0-9_-]{16,100}$")

@router.post("/sandbox/operate")
def sandbox_operate(body:SandboxOperation,request:Request):
    tenant=_write(request)["workspace_id"]
    with database() as db:
        wallet=db.execute("""SELECT credits,units,staked_units
            FROM genesis_sandbox_wallets WHERE workspace_id=%s FOR UPDATE""",
            (tenant,)).fetchone()
        if not wallet:
            raise HTTPException(status_code=409,detail="START_SANDBOX_FIRST")
        previous=db.execute("""SELECT action,amount,category FROM genesis_sandbox_operations
             WHERE workspace_id=%s AND request_id=%s""",
             (tenant,body.request_id)).fetchone()
        if previous:
            if previous["action"]!=body.action or previous["amount"]!=body.amount or (body.action=="invest" and previous["category"]!=body.category):
                raise HTTPException(409,"REQUEST_ID_REUSED_WITH_DIFFERENT_ACTION")
            return {"replayed":True,**_public_wallet(db,tenant)}
        credits=wallet["credits"]
        units=wallet["units"]
        staked=wallet["staked_units"]
        category=body.category
        value=body.amount
        now=datetime.now(timezone.utc)
        if body.action=="buy":
            if credits<value*RATE:raise HTTPException(409,"INSUFFICIENT_DEMO_CREDITS")
            credits-=value*RATE
            units+=value
            category=None
        elif body.action=="sell":
            if units<value:raise HTTPException(409,"INSUFFICIENT_DEMO_UNITS")
            units-=value
            credits+=value*RATE
            category=None
        elif body.action=="stake":
            if units<value:raise HTTPException(409,"INSUFFICIENT_DEMO_UNITS")
            units-=value
            staked+=value
            category="demo_stake"
            db.execute("""INSERT INTO genesis_sandbox_positions
              (id,workspace_id,category,units,unlock_at)
              VALUES (%s,%s,%s,%s,%s)""",
              (uid("gpos"),tenant,category,value,now+timedelta(days=7)))
        elif body.action=="invest":
            if category not in PROGRAMS:raise HTTPException(422,"INVALID_SIMULATION_CATEGORY")
            if credits<value:raise HTTPException(409,"INSUFFICIENT_DEMO_CREDITS")
            credits-=value
            db.execute("""INSERT INTO genesis_sandbox_positions
              (id,workspace_id,category,units)
              VALUES (%s,%s,%s,%s)""",
              (uid("gpos"),tenant,category,value))
        elif body.action=="unstake":
            # Exact fixed-unit withdrawal; can use multiple matured positions.
            matured=db.execute("""SELECT id,units FROM genesis_sandbox_positions
                WHERE workspace_id=%s AND category='demo_stake' AND closed_at IS NULL
                AND unlock_at <= now()
                ORDER BY created_at,id FOR UPDATE""",(tenant,)).fetchall()
            remaining=value
            for position in matured:
                if not remaining:break
                take=min(remaining,position["units"])
                if take==position["units"]:
                    db.execute("""UPDATE genesis_sandbox_positions SET closed_at=now()
                       WHERE id=%s""",(position["id"],))
                else:
                    db.execute("""UPDATE genesis_sandbox_positions SET units=units-%s
                       WHERE id=%s""",(take,position["id"]))
                    db.execute("""INSERT INTO genesis_sandbox_positions
                       (id,workspace_id,category,units,unlock_at,closed_at)
                       VALUES (%s,%s,'demo_stake',%s,now(),now())""",
                       (uid("gpos"),tenant,take))
                remaining-=take
            if remaining:raise HTTPException(409,"DEMO_STAKE_LOCKED_OR_INSUFFICIENT")
            units+=value
            staked-=value
            category="demo_stake"
        db.execute("""UPDATE genesis_sandbox_wallets
             SET credits=%s,units=%s,staked_units=%s WHERE workspace_id=%s""",
             (credits,units,staked,tenant))
        db.execute("""INSERT INTO genesis_sandbox_operations
             (id,workspace_id,request_id,action,amount,category)
             VALUES (%s,%s,%s,%s,%s,%s)""",
             (uid("gop"),tenant,body.request_id,body.action,value,category))
        event(db,tenant,"genesis.sandbox."+body.action,body.request_id)
        state=_public_wallet(db,tenant)
    return {"replayed":False,**state}
