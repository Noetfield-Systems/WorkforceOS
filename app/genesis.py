"""WorkforceOS Genesis Season Zero: source-backed internal participation only.

Genesis participation is opt-in and does not create a token, a contract,
a future distribution right, or a tradable balance. The existing
participation_points ledger is the single source of XP truth.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from .storage import database, event
from . import rewards

router = APIRouter(prefix="/api/genesis", tags=["Genesis"])
SEASON_ID = "season-zero"
SEASON_START = datetime(2026, 11, 17, tzinfo=timezone.utc)
TERMS_VERSION = "2026-11-17/v1"
JOIN_BONUS = 10

# Proposed modelling assumptions, not an issued supply or approved rights.
SCENARIO = {
    "status": "ILLUSTRATIVE_ONLY",
    "working_name": "WorkforceOS Genesis Token (concept)",
    "ticker": None,
    "scenario_total_units": 100_000_000,
    "units_created": 0,
    "token_contract": None,
    "chain": None,
    "sale_active": False,
    "claim_active": False,
    "airdrop_distribution_active": False,
    "xp_to_token_rate": None,
    "reference_price": None,
    "pool_scenarios": [
        {"id": "community", "name": "Community participation", "percent": 30},
        {"id": "ecosystem", "name": "Ecosystem and product adoption", "percent": 25},
        {"id": "builders", "name": "Agent creators and builders", "percent": 20},
        {"id": "treasury", "name": "Operational treasury", "percent": 15},
        {"id": "future_liquidity", "name": "Potential future liquidity", "percent": 10},
    ],
    "notice": (
        "This is a non-binding hypothetical tokenomics model. No token has been "
        "minted, issued, sold or allocated. XP does not confer an airdrop, "
        "financial right, cash value, future conversion, or priority for a sale."
    ),
}
assert sum(x["percent"] for x in SCENARIO["pool_scenarios"]) == 100

class JoinGenesis(BaseModel):
    acknowledge: bool

def initialize_genesis():
    with database() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS genesis_memberships (
            workspace_id text PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
            season_id text NOT NULL CHECK (season_id='season-zero'),
            terms_version text NOT NULL,
            joined_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS genesis_memberships_joined_idx
                   ON genesis_memberships(joined_at ASC)""")

def _auth(request: Request):
    from .main import _authentication
    return _authentication(request)

def _write_auth(request: Request):
    from .main import _authentication, _write
    return _write(request, _authentication(request))

def _alias(workspace_id):
    # Workspace IDs are generated random opaque identifiers; never expose the
    # ID, email, workspace name or registration date on the public board.
    return "Member " + hashlib.sha256(
        ("workforce-genesis-zero:" + workspace_id).encode("utf-8")
    ).hexdigest()[:8].upper()

def _score_rows(db,limit=30):
    return db.execute("""SELECT m.workspace_id,m.joined_at,
          COALESCE(SUM(p.points),0)::integer AS score
        FROM genesis_memberships m
        LEFT JOIN participation_points p ON p.workspace_id=m.workspace_id
          AND p.created_at >= %s
        WHERE m.season_id=%s
        GROUP BY m.workspace_id,m.joined_at
        ORDER BY score DESC,m.joined_at ASC,m.workspace_id ASC LIMIT %s
        """,(SEASON_START,SEASON_ID,limit)).fetchall()

def _summary(db):
    r = db.execute("""SELECT count(*)::integer AS members
                      FROM genesis_memberships WHERE season_id=%s""",
                   (SEASON_ID,)).fetchone()
    xp = db.execute("""SELECT COALESCE(sum(p.points),0)::bigint AS earned
                       FROM genesis_memberships m
                       JOIN participation_points p ON p.workspace_id=m.workspace_id
                       WHERE m.season_id=%s AND p.created_at >= %s""",
                    (SEASON_ID,SEASON_START)).fetchone()
    engagement=db.execute("""SELECT
        count(DISTINCT p.workspace_id) FILTER
           (WHERE p.kind='first_agent')::integer AS agent_builders,
        count(DISTINCT p.source_id) FILTER
           (WHERE p.kind='activated_referral')::integer AS activated_referrals
        FROM genesis_memberships m
        JOIN participation_points p ON p.workspace_id=m.workspace_id
        WHERE m.season_id=%s AND p.created_at >= %s""",
        (SEASON_ID,SEASON_START)).fetchone()
    return {"joined_workspaces":int(r["members"]),
            "recorded_genesis_xp":int(xp["earned"]),
            "agent_builders":int(engagement["agent_builders"]),
            "activated_referrals":int(engagement["activated_referrals"])}

@router.get("/program")
def program():
    snapshot=rewards.program_snapshot()
    return {
        "id": SEASON_ID,
        "name": "Genesis Season Zero",
        "phase": "OPEN_OFFCHAIN",
        "starts_at": SEASON_START.isoformat(),
        "ends_at": None,
        "wallet_required": False,
        "join_bonus_xp": JOIN_BONUS,
        "season_currency": "INTERNAL_XP",
        "transferable": False,
        "token_minted": False,
        "onchain": False,
        "airdrop_right": False,
        "benefit_guaranteed": False,
        "eligibility": "Opt-in workspace with recorded first-party activity, subject to terms",
        "qualifying_activity": (
            "Recorded XP events created from the season start, counted only "
            "for workspaces that opted into Genesis."
        ),
        "quests": [
            {"id": "genesis_join", "label": "Join Genesis", "xp": JOIN_BONUS,
             "verification": "One recorded member opt-in per workspace"}
        ] + [{"id": q["id"], "label": q["label"], "xp": q["points"],
              "verification": q["frequency"]} for q in snapshot["quests"]],
        "referral_rule": snapshot["referral_terms"],
        "scenario": SCENARIO,
        "notice": (
            "Season Zero is a real off-chain XP program. Participation does "
            "not guarantee a token, airdrop, monetary reward or future access."
        ),
    }

@router.get("/overview")
def overview():
    with database() as db:
        actual=_summary(db)
    return {**actual,"phase":"OPEN_OFFCHAIN","currency":"XP",
            "source":"Real opt-ins and participation ledger only",
            "not_verified_unique_people":True,"no_issued_tokens":True}

@router.get("/leaderboard")
def leaderboard():
    with database() as db:
        rows=_score_rows(db,30)
    return {
        "season_id": SEASON_ID,
        "source": "Recorded XP earned from qualifying first-party events",
        "notice": "Pseudonymous workspace standings, not proof of unique people or token allocations.",
        "leaders": [
            {"rank":i+1,"member":_alias(row["workspace_id"]),
             "genesis_xp":int(row["score"])}
            for i,row in enumerate(rows)
        ],
    }

@router.get("/me")
def my_genesis(account=Depends(_auth)):
    tenant=account["workspace_id"]
    with database() as db:
        record=db.execute("""SELECT joined_at,terms_version FROM genesis_memberships
                             WHERE workspace_id=%s AND season_id=%s""",
                          (tenant,SEASON_ID)).fetchone()
        balance=db.execute("""SELECT COALESCE(sum(points),0)::integer AS xp
                             FROM participation_points WHERE workspace_id=%s
                             AND created_at >= %s""",
                           (tenant,SEASON_START)).fetchone()
        lifetime=db.execute("""SELECT COALESCE(sum(points),0)::integer AS xp
                              FROM participation_points WHERE workspace_id=%s""",
                            (tenant,)).fetchone()
        history=db.execute("""SELECT kind,points,created_at FROM participation_points
                             WHERE workspace_id=%s AND created_at >= %s
                             ORDER BY created_at DESC LIMIT 30""",
                           (tenant,SEASON_START)).fetchall() if record else []
        rows=_score_rows(db,10000) if record else []
    ranking=next((i+1 for i,row in enumerate(rows)
                  if row["workspace_id"]==tenant),None)
    return {
        "joined": bool(record),
        "season_id": SEASON_ID,
        "member": _alias(tenant) if record else None,
        "joined_at": record["joined_at"].isoformat() if record else None,
        "terms_version": record["terms_version"] if record else None,
        "genesis_xp": int(balance["xp"]) if record else 0,
        "lifetime_xp": int(lifetime["xp"]),
        "rank": ranking,
        "history": [
            {"kind":h["kind"],"xp":h["points"],
             "created_at":h["created_at"].isoformat()} for h in history
        ],
        "eligible_for_guaranteed_token": False,
        "notice": program()["notice"],
    }

@router.post("/join")
def join_genesis(body: JoinGenesis,request: Request):
    account=_write_auth(request)
    if not body.acknowledge:
        raise HTTPException(status_code=422,detail="ACKNOWLEDGEMENT_REQUIRED")
    tenant=account["workspace_id"]
    with database() as db:
        row=db.execute("""INSERT INTO genesis_memberships
            (workspace_id,season_id,terms_version)
            VALUES (%s,%s,%s)
            ON CONFLICT (workspace_id) DO NOTHING
            RETURNING workspace_id""",
            (tenant,SEASON_ID,TERMS_VERSION)).fetchone()
        if row:
            rewards.award(db,tenant,kind="genesis_join",
                claim_key="genesis:season-zero:join",
                points=JOIN_BONUS,source_id=SEASON_ID)
            event(db,tenant,"genesis.joined",SEASON_ID)
    return {"joined":True,"new_member":bool(row),
            "xp_awarded":JOIN_BONUS if row else 0,
            "season_id":SEASON_ID,"notice":program()["notice"]}
