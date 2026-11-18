"""WorkforceOS member app: real nonfinancial WC utility ledger + isolated DEMO economy.

Existing participation_points remains the ONLY XP authority. Wallet Credits (WC)
are an internal, nontransferable in-app utility earned through verified XP source
events. DEMO USD, DEMO tokens and imaginary investments can never mint WC or XP.
"""
from __future__ import annotations
import hashlib
import json
from datetime import date, datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from .storage import database, event, uid

router = APIRouter(prefix="/api/member", tags=["Member world"])
CREDIT_SYMBOL = "WC"
CREDIT_REWARDS = {
    "daily_checkin": 2, "agent_basics_quiz": 4, "daily_game": 3,
    "first_agent": 8, "activated_referral": 10, "welcome_gift": 3,
    "genesis_join": 4, "streak_day7": 5,
}
SHOP = (
    {"id": "chrome_profile", "name": "Chrome profile frame", "price": 12,
     "category": "Profile cosmetic", "description": "A visible highlight around your member profile."},
    {"id": "builder_badge", "name": "Builder badge", "price": 18,
     "category": "Profile cosmetic", "description": "Display a builder insignia on your member card."},
    {"id": "midnight_theme", "name": "Midnight theme", "price": 24,
     "category": "Interface cosmetic", "description": "Unlock an optional darker member-app theme."},
)
GAMES = (
    {"question": "An agent asks to read a connected API. What should happen first?",
     "options": ["Use any saved credential", "Verify the user authorized that scope", "Publish the key on the public page", "Assume access is granted"], "correct": 1,
     "explanation": "User authorization and scoped provider permissions come before any action."},
    {"question": "Which event should grant mission points for an API integration?",
     "options": ["Opening the landing page", "A mocked success notification", "A confirmed tool execution", "Copying an example URL"], "correct": 2,
     "explanation": "Reward verified server-side work, not clicks or unverified UI claims."},
    {"question": "A customer asks an agent to complete work. What is a trustworthy proof?",
     "options": ["An actual source task receipt", "A colorful dashboard", "A promised delivery", "A drafted marketing claim"], "correct": 0,
     "explanation": "Source-backed receipts distinguish executed work from a proposal."},
    {"question": "What is the correct first response when a model provider hits a quota?",
     "options": ["Invent a successful result", "Retry endlessly", "Use an authorized fallback with explicit status", "Discard the customer's task"], "correct": 2,
     "explanation": "A bounded and authorized fallback can restore delivery without fabricating success."},
    {"question": "When can an XP balance be called a tradable cryptocurrency?",
     "options": ["When a member reaches day seven", "Only if a real transferable token is issued", "Whenever a founder picks a symbol", "After adding a demo purchase button"], "correct": 1,
     "explanation": "Internal XP and demo credits do not become crypto merely by naming them."},
    {"question": "Which action best demonstrates that a new builder is activated?",
     "options": ["Clicking a referral URL", "Opening a social post", "Registering and saving a real Agent DNA", "Reading an illustrative tokenomics page"], "correct": 2,
     "explanation": "Verified account creation plus a substantive product action beats an invite click."},
)
SIMULATED_PROJECTS = (
    {"id": "agent_lab", "name": "Agent Lab", "theme": "Automation experiments", "risk": "Imaginary high risk"},
    {"id": "creator_network", "name": "Creator Network", "theme": "Independent creator tools", "risk": "Imaginary high risk"},
    {"id": "research_collective", "name": "Research Collective", "theme": "Open knowledge workflows", "risk": "Imaginary high risk"},
)
SIMULATED_UNIT_PRICE_CENTS = 1000  # 10 DEMO USD, not a token valuation.
STARTING_DEMO_CENTS = 100_000  # 1,000 DEMO USD, unredeemable.

def initialize_member_world():
    with database() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS member_credit_ledger(
          id text PRIMARY KEY,workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          claim_key text NOT NULL,kind text NOT NULL,delta integer NOT NULL CHECK(delta<>0 AND abs(delta)<=100),
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(workspace_id,claim_key)
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS member_credit_ledger_owner_idx
                      ON member_credit_ledger(workspace_id,created_at DESC)""")
        db.execute("""CREATE TABLE IF NOT EXISTS member_items(
          workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          item_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY(workspace_id,item_id)
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS member_demo_accounts(
          workspace_id text PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
          demo_cash_cents integer NOT NULL DEFAULT 100000 CHECK(demo_cash_cents>=0),
          demo_units integer NOT NULL DEFAULT 0 CHECK(demo_units>=0),
          demo_staked integer NOT NULL DEFAULT 0 CHECK(demo_staked>=0),
          created_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS member_demo_positions(
          workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          project_id text NOT NULL,invested_cents integer NOT NULL DEFAULT 0 CHECK(invested_cents>=0),
          PRIMARY KEY(workspace_id,project_id)
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS member_demo_operations(
          id text PRIMARY KEY,workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          request_id text NOT NULL,payload_hash text NOT NULL,kind text NOT NULL,
          demo_cash_delta integer NOT NULL DEFAULT 0,unit_delta integer NOT NULL DEFAULT 0,
          staked_delta integer NOT NULL DEFAULT 0,project_id text,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(workspace_id,request_id)
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS member_demo_operations_owner_idx
                      ON member_demo_operations(workspace_id,created_at DESC)""")

def award_credit(db, tenant, kind, claim_key):
    """Award only after a verified existing participation_points insert succeeds."""
    amount = CREDIT_REWARDS.get(kind, 0)
    if not amount:
        return False
    row = db.execute("""INSERT INTO member_credit_ledger
      (id,workspace_id,claim_key,kind,delta) VALUES (%s,%s,%s,%s,%s)
      ON CONFLICT(workspace_id,claim_key) DO NOTHING RETURNING id""",
      (uid("wc"),tenant,"earn:"+claim_key,kind,amount)).fetchone()
    if row:
        event(db,tenant,"member.credit_earned",row["id"],kind)
    return bool(row)

def _auth(request: Request):
    from .main import _authentication
    return _authentication(request)

def _write_auth(request: Request):
    from .main import _authentication, _write
    return _write(request, _authentication(request))

def _credit_balance(db,tenant):
    return int(db.execute(
        "SELECT COALESCE(sum(delta),0) AS n FROM member_credit_ledger WHERE workspace_id=%s",
        (tenant,)).fetchone()["n"])

def _streak(db,tenant,today=None):
    today=today or datetime.now(timezone.utc).date()
    rows=db.execute("""SELECT claim_key FROM participation_points
      WHERE workspace_id=%s AND kind='daily_checkin'
      ORDER BY claim_key DESC LIMIT 400""",(tenant,)).fetchall()
    claimed=set()
    for row in rows:
        try:claimed.add(date.fromisoformat(row["claim_key"].removeprefix("daily:")))
        except ValueError:pass
    cursor=today if today in claimed else today-timedelta(days=1)
    value=0
    while cursor in claimed:
        value+=1
        cursor-=timedelta(days=1)
    return {"days":value,"claimed_today":today in claimed,
            "next_bonus_at_days":7 if value<7 else ((value//7)+1)*7}

def _demo_init(db,tenant):
    db.execute("""INSERT INTO member_demo_accounts(workspace_id)
                  VALUES (%s) ON CONFLICT DO NOTHING""",(tenant,))

def _demo_snapshot(db,tenant):
    _demo_init(db,tenant)
    a=db.execute("""SELECT demo_cash_cents,demo_units,demo_staked FROM member_demo_accounts
                    WHERE workspace_id=%s""",(tenant,)).fetchone()
    positions=db.execute("""SELECT project_id,invested_cents FROM member_demo_positions
                            WHERE workspace_id=%s ORDER BY project_id""",(tenant,)).fetchall()
    return {
        "cash_cents":a["demo_cash_cents"],"units":a["demo_units"],
        "staked_units":a["demo_staked"],
        "holdings_demo_cents":a["demo_units"]*SIMULATED_UNIT_PRICE_CENTS,
        "staked_demo_cents":a["demo_staked"]*SIMULATED_UNIT_PRICE_CENTS,
        "positions":[dict(x) for x in positions],
        "reference_unit_price_cents":SIMULATED_UNIT_PRICE_CENTS,
        "currency":"DEMO_USD","actual_payment":False,"actual_asset":False,
        "withdrawal_available":False,"onchain":False,"staking_rewards":False,
    }

def _daily_game(today=None):
    today=today or datetime.now(timezone.utc).date()
    index=today.toordinal()%len(GAMES)
    g=GAMES[index]
    return {"id":"daily_agent_challenge","date":today.isoformat(),"question":g["question"],
            "options":[{"id":str(i),"text":o} for i,o in enumerate(g["options"])],
            "reward_xp":8,"reward_credits":CREDIT_REWARDS["daily_game"],
            "frequency":"once_per_utc_day_after_correct_answer"}

def _overview(db,tenant,email,workspace_name):
    xp=db.execute("SELECT COALESCE(sum(points),0) n FROM participation_points WHERE workspace_id=%s",
                  (tenant,)).fetchone()["n"]
    genesis=db.execute("SELECT joined_at FROM genesis_memberships WHERE workspace_id=%s",
                       (tenant,)).fetchone()
    items=db.execute("SELECT item_id FROM member_items WHERE workspace_id=%s ORDER BY item_id",
                     (tenant,)).fetchall()
    now=datetime.now(timezone.utc)
    day_key="game:"+now.date().isoformat()
    game_done=db.execute("""SELECT 1 FROM participation_points WHERE workspace_id=%s
                             AND claim_key=%s""",(tenant,day_key)).fetchone()
    return {
        "member":{"workspace_name":workspace_name,"email":email,"genesis_joined":bool(genesis)},
        "xp":{"balance":int(xp),"unit":"XP","spendable":False,"actual_saved":True},
        "credits":{"balance":_credit_balance(db,tenant),"unit":CREDIT_SYMBOL,
                   "spendable_in_app":True,"transferable":False,"cash_value":False},
        "streak":_streak(db,tenant),"game":{"completed_today":bool(game_done),**_daily_game(now.date())},
        "shop":{"items":list(SHOP),"owned":[x["item_id"] for x in items]},
        "demo":_demo_snapshot(db,tenant),
        "quests":[
            {"id":"daily_checkin","name":"Daily claim","xp":5,"credits":2},
            {"id":"daily_game","name":"Daily Agent Challenge","xp":8,"credits":3},
            {"id":"agent_basics_quiz","name":"Agent fundamentals quiz","xp":15,"credits":4},
            {"id":"first_agent","name":"Create a real Agent DNA","xp":20,"credits":8},
            {"id":"activated_referral","name":"Refer an activated builder","xp":25,"credits":10},
        ],
        "financial_mode":"SIMULATION_ONLY","token_issued":False,
        "cashout_available":False,"asset_rights":False,
        "notice":"XP and WC are real database records for app participation only. WC cannot be bought with money, transferred, redeemed or converted into any future token. All trading, staking and investing are isolated fictional simulations with no returns or withdrawals.",
    }

@router.get("/overview")
def overview(account=Depends(_auth)):
    with database() as db:
        return _overview(db,account["workspace_id"],account["email"],account["workspace_name"])

@router.get("/history")
def history(account=Depends(_auth)):
    tenant=account["workspace_id"]
    with database() as db:
        xp=db.execute("""SELECT kind,points,created_at FROM participation_points
                         WHERE workspace_id=%s ORDER BY created_at DESC LIMIT 60""",(tenant,)).fetchall()
        credits=db.execute("""SELECT kind,delta,created_at FROM member_credit_ledger
                              WHERE workspace_id=%s ORDER BY created_at DESC LIMIT 60""",(tenant,)).fetchall()
        demo=db.execute("""SELECT kind,demo_cash_delta,unit_delta,staked_delta,project_id,created_at
                           FROM member_demo_operations WHERE workspace_id=%s
                           ORDER BY created_at DESC LIMIT 40""",(tenant,)).fetchall()
    return {"xp":[{"kind":r["kind"],"amount":r["points"],"at":r["created_at"].isoformat()} for r in xp],
            "credits":[{"kind":r["kind"],"amount":r["delta"],"at":r["created_at"].isoformat()} for r in credits],
            "demo":[{"kind":r["kind"],"cash_delta_cents":r["demo_cash_delta"],
                     "units_delta":r["unit_delta"],"staked_delta":r["staked_delta"],
                     "project_id":r["project_id"],"at":r["created_at"].isoformat()} for r in demo],
            "note":"Only XP and WC reflect actual nonfinancial product activity. The demo tab is fiction."}

class GameAnswer(BaseModel):
    answer_id: str=Field(pattern="^[0-3]$")

@router.post("/game")
def game(request:Request,body:GameAnswer):
    account=_write_auth(request)
    tenant=account["workspace_id"]
    today=datetime.now(timezone.utc).date()
    question=GAMES[today.toordinal()%len(GAMES)]
    if int(body.answer_id)!=question["correct"]:
        return {"correct":False,"awarded":False,"xp":0,"credits":0,
                "explanation":question["explanation"]}
    from . import rewards
    with database() as db:
        granted=rewards.award(db,tenant,kind="daily_game",
                     claim_key="game:"+today.isoformat(),points=8,source_id="daily_agent_challenge")
        total=db.execute("SELECT COALESCE(sum(points),0) n FROM participation_points WHERE workspace_id=%s",
                         (tenant,)).fetchone()["n"]
        credits=_credit_balance(db,tenant)
    return {"correct":True,"awarded":granted,"xp":8 if granted else 0,
            "credits":CREDIT_REWARDS["daily_game"] if granted else 0,
            "xp_balance":int(total),"credit_balance":credits,
            "explanation":question["explanation"],
            "message":"Recorded in PostgreSQL" if granted else "Already completed today"}

class Purchase(BaseModel):
    item_id: str=Field(pattern="^[a-z][a-z0-9_]{2,40}$")

@router.post("/shop/purchase")
def purchase(request:Request,body:Purchase):
    account=_write_auth(request)
    tenant=account["workspace_id"]
    item=next((i for i in SHOP if i["id"]==body.item_id),None)
    if not item:raise HTTPException(status_code=404,detail="ITEM_NOT_FOUND")
    with database() as db:
        db.execute("SELECT id FROM workspaces WHERE id=%s FOR UPDATE",(tenant,))
        existing=db.execute("""SELECT 1 FROM member_items WHERE workspace_id=%s AND item_id=%s""",
                            (tenant,item["id"])).fetchone()
        if existing:raise HTTPException(status_code=409,detail="ITEM_ALREADY_OWNED")
        if _credit_balance(db,tenant)<item["price"]:
            raise HTTPException(status_code=409,detail="NOT_ENOUGH_INTERNAL_CREDITS")
        db.execute("""INSERT INTO member_credit_ledger
          (id,workspace_id,claim_key,kind,delta) VALUES (%s,%s,%s,%s,%s)""",
          (uid("wc"),tenant,"purchase:"+item["id"],"shop_"+item["id"],-item["price"]))
        db.execute("INSERT INTO member_items(workspace_id,item_id) VALUES (%s,%s)",
                   (tenant,item["id"]))
        event(db,tenant,"member.item_unlocked",item["id"])
        balance=_credit_balance(db,tenant)
    return {"purchased":True,"item":item["id"],"new_credit_balance":balance,
            "actual_payment":False,"real_asset":False}

class DemoAction(BaseModel):
    request_id:str=Field(pattern=r"^[a-zA-Z0-9_-]{12,80}$")
    action:str=Field(pattern="^(buy|stake|unstake|invest)$")
    units:int=Field(default=0,ge=0,le=1000)
    amount_cents:int=Field(default=0,ge=0,le=100000)
    project_id:str|None=None

@router.post("/sandbox/action")
def sandbox_action(request:Request,body:DemoAction):
    account=_write_auth(request)
    tenant=account["workspace_id"]
    payload=json.dumps(body.model_dump(),sort_keys=True)
    payload_hash=hashlib.sha256(payload.encode()).hexdigest()
    with database() as db:
        db.execute("SELECT id FROM workspaces WHERE id=%s FOR UPDATE",(tenant,))
        prior=db.execute("""SELECT payload_hash FROM member_demo_operations
                            WHERE workspace_id=%s AND request_id=%s""",
                         (tenant,body.request_id)).fetchone()
        if prior:
            if prior["payload_hash"]!=payload_hash:
                raise HTTPException(status_code=409,detail="REQUEST_ID_REUSED_DIFFERENT_ACTION")
            return {"applied":False,"duplicate":True,"demo":_demo_snapshot(db,tenant)}
        state=_demo_snapshot(db,tenant)
        cash_delta=unit_delta=staked_delta=0
        if body.action in ("buy","stake","unstake"):
            if body.units<1 or body.amount_cents!=0 or body.project_id is not None:
                raise HTTPException(status_code=422,detail="VALID_DEMO_UNIT_COUNT_REQUIRED")
            if body.action=="buy":
                cash_delta=-body.units*SIMULATED_UNIT_PRICE_CENTS
                unit_delta=body.units
                if state["cash_cents"]<-cash_delta:
                    raise HTTPException(status_code=409,detail="INSUFFICIENT_DEMO_FUNDS")
            elif body.action=="stake":
                if state["units"]<body.units:
                    raise HTTPException(status_code=409,detail="INSUFFICIENT_DEMO_UNITS")
                unit_delta=-body.units;staked_delta=body.units
            elif body.action=="unstake":
                if state["staked_units"]<body.units:
                    raise HTTPException(status_code=409,detail="INSUFFICIENT_DEMO_STAKED_UNITS")
                unit_delta=body.units;staked_delta=-body.units
        elif body.action=="invest":
            if body.project_id not in {p["id"] for p in SIMULATED_PROJECTS}:
                raise HTTPException(status_code=422,detail="UNKNOWN_DEMO_PROJECT")
            if body.amount_cents<1000 or body.units!=0:
                raise HTTPException(status_code=422,detail="DEMO_INVESTMENT_MINIMUM_1000_CENTS")
            if state["cash_cents"]<body.amount_cents:
                raise HTTPException(status_code=409,detail="INSUFFICIENT_DEMO_FUNDS")
            cash_delta=-body.amount_cents
            db.execute("""INSERT INTO member_demo_positions(workspace_id,project_id,invested_cents)
               VALUES (%s,%s,%s) ON CONFLICT(workspace_id,project_id)
               DO UPDATE SET invested_cents=member_demo_positions.invested_cents+excluded.invested_cents""",
               (tenant,body.project_id,body.amount_cents))
        db.execute("""UPDATE member_demo_accounts
                      SET demo_cash_cents=demo_cash_cents+%s,demo_units=demo_units+%s,
                          demo_staked=demo_staked+%s WHERE workspace_id=%s""",
                   (cash_delta,unit_delta,staked_delta,tenant))
        db.execute("""INSERT INTO member_demo_operations
          (id,workspace_id,request_id,payload_hash,kind,demo_cash_delta,unit_delta,staked_delta,project_id)
          VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
          (uid("dem"),tenant,body.request_id,payload_hash,body.action,
           cash_delta,unit_delta,staked_delta,body.project_id))
        event(db,tenant,"member.demo_activity",body.action,body.project_id or "")
        new_state=_demo_snapshot(db,tenant)
    return {"applied":True,"duplicate":False,"demo":new_state,
            "notice":"Fictional sandbox only; no cash, token purchase, investment contract, interest or return."}

@router.get("/sandbox/projects")
def sandbox_projects():
    return {"projects":list(SIMULATED_PROJECTS),"mode":"SIMULATION_ONLY",
            "notice":"Projects are fictional practice scenarios. They are not investment opportunities."}
