"""Spendable internal Genesis WC credits: real rewards, cosmetic-only utility.

XP remains in participation_points. WC is a separate non-financial in-app
utility balance, earned only from real source-verified XP events. WC has zero
fiat, blockchain, investment, trade, or redemption value. The existing DEMO
sandbox stays completely independent from WC.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from .storage import database

router=APIRouter(prefix="/api/genesis/credits",tags=["Genesis WC utility"])
SHOP=(
 {"id":"pioneer_frame","name":"Pioneer profile frame","cost":10,
  "description":"Equip a refined copper frame on your private member profile.","effect":"profile_frame"},
 {"id":"builder_badge","name":"Builder insignia","cost":18,
  "description":"Add an in-app member badge beside your pseudonymous founder ID.","effect":"founder_badge"},
 {"id":"nocturne_theme","name":"Nocturne studio theme","cost":24,
  "description":"Unlock a premium dark-blue styling option in the Genesis member app.","effect":"visual_theme"},
)
CREDIT_BY_KIND={
 "genesis_join":4,
 "daily_checkin":2,
 "daily_streak_bonus":2,
 "genesis_daily_game":3,
 "agent_basics_quiz":4,
 "first_agent":8,
 "activated_referral":10,
 "welcome_gift":3,
 "product_feedback":4,
}
def credit_for(kind,points=0):
    if kind=="daily_streak_bonus" and int(points)>=10:return 5
    return CREDIT_BY_KIND.get(kind,0)

def initialize_genesis_credits():
    with database() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS genesis_credit_entries(
           workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
           entry_key text NOT NULL,
           kind text NOT NULL,
           delta integer NOT NULL CHECK(delta BETWEEN -100 AND 100 AND delta<>0),
           created_at timestamptz NOT NULL DEFAULT now(),
           PRIMARY KEY(workspace_id,entry_key)
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS genesis_credit_owner_idx
                      ON genesis_credit_entries(workspace_id,created_at DESC)""")
        db.execute("""CREATE TABLE IF NOT EXISTS genesis_credit_items(
           workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
           item_id text NOT NULL,
           created_at timestamptz NOT NULL DEFAULT now(),
           PRIMARY KEY(workspace_id,item_id)
        )""")

def record_earned_credit(db,tenant,*,kind,claim_key,points):
    """Only invoked after a real XP source insert, inside that transaction."""
    amount=credit_for(kind,points)
    if not amount:return False
    row=db.execute("""INSERT INTO genesis_credit_entries
       (workspace_id,entry_key,kind,delta)
       VALUES (%s,%s,%s,%s)
       ON CONFLICT(workspace_id,entry_key) DO NOTHING RETURNING entry_key""",
       (tenant,"earn:"+claim_key,kind,amount)).fetchone()
    return bool(row)

def _sync_existing_xp(db,tenant):
    """Retro-credit genuine past XP; replay-safe on every login/GET."""
    events=db.execute("""SELECT claim_key,kind,points,created_at
       FROM participation_points WHERE workspace_id=%s
         AND kind=ANY(%s) ORDER BY created_at ASC""",
       (tenant,list(CREDIT_BY_KIND))).fetchall()
    for x in events:
        amount=credit_for(x["kind"],x["points"])
        if amount:
            db.execute("""INSERT INTO genesis_credit_entries
             (workspace_id,entry_key,kind,delta,created_at)
             VALUES (%s,%s,%s,%s,%s) ON CONFLICT(workspace_id,entry_key) DO NOTHING""",
             (tenant,"earn:"+x["claim_key"],x["kind"],amount,x["created_at"]))

def _balance(db,tenant):
    return int(db.execute("""SELECT COALESCE(SUM(delta),0) AS n FROM genesis_credit_entries
       WHERE workspace_id=%s""",(tenant,)).fetchone()["n"])

def _auth(request:Request):
    from .main import _authentication
    return _authentication(request)

def _write_auth(request:Request):
    from .main import _write,_authentication
    return _write(request,_authentication(request))

def snapshot(db,tenant):
    _sync_existing_xp(db,tenant)
    owned=db.execute("SELECT item_id FROM genesis_credit_items WHERE workspace_id=%s ORDER BY item_id",
                     (tenant,)).fetchall()
    history=db.execute("""SELECT kind,delta,created_at FROM genesis_credit_entries
          WHERE workspace_id=%s ORDER BY created_at DESC,entry_key DESC LIMIT 60""",
          (tenant,)).fetchall()
    return {"unit":"WC","balance":_balance(db,tenant),
            "owned":[x["item_id"] for x in owned],
            "items":list(SHOP),
            "history":[{"kind":x["kind"],"delta":x["delta"],
                        "created_at":x["created_at"].isoformat()} for x in history],
            "internal":True,"spendable_for_cosmetics":True,"transferable":False,
            "purchasable_for_money":False,"redeemable":False,"onchain":False,
            "issued_crypto_token":False,"token_conversion_promised":False,
            "cash_value":False,
            "notice":"WC is an internal, nontransferable app utility earned from actual XP events. It is NOT DEMO credits, a real cryptocurrency, money, a payment balance, a deposit, an investment, or a future token entitlement."}

@router.get("/me")
def me(account=Depends(_auth)):
    with database() as db:
        return snapshot(db,account["workspace_id"])

class Purchase(BaseModel):
    item_id:str=Field(pattern=r"^[a-z][a-z0-9_]{2,40}$")

@router.post("/purchase")
def purchase(request:Request,body:Purchase):
    account=_write_auth(request)
    tenant=account["workspace_id"]
    item=next((i for i in SHOP if i["id"]==body.item_id),None)
    if item is None:raise HTTPException(404,"ITEM_NOT_FOUND")
    with database() as db:
        # One tenant-level lock protects the sum-based balance and debits.
        db.execute("SELECT id FROM workspaces WHERE id=%s FOR UPDATE",(tenant,))
        _sync_existing_xp(db,tenant)
        owned=db.execute("""SELECT 1 FROM genesis_credit_items
           WHERE workspace_id=%s AND item_id=%s""",(tenant,item["id"])).fetchone()
        if owned:raise HTTPException(409,"ITEM_ALREADY_UNLOCKED")
        if _balance(db,tenant)<item["cost"]:
            raise HTTPException(409,"NOT_ENOUGH_EARNED_WC")
        db.execute("""INSERT INTO genesis_credit_entries
          (workspace_id,entry_key,kind,delta) VALUES (%s,%s,%s,%s)""",
          (tenant,"purchase:"+item["id"],"cosmetic_unlock",-item["cost"]))
        db.execute("""INSERT INTO genesis_credit_items(workspace_id,item_id)
          VALUES (%s,%s)""",(tenant,item["id"]))
        result=snapshot(db,tenant)
    return {"unlocked":True,"item_id":item["id"],"cost_wc":item["cost"],
            "balance_wc":result["balance"],"owned":result["owned"],
            "cash_payment":False,"real_token":False}
