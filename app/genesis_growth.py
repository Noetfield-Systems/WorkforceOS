"""Source-backed Genesis growth intelligence, member preferences and cohort reporting.

No second XP ledger. No client-submitted event may create score or token rights.
Existing participation_points and original Genesis membership are authoritative.
"""
from __future__ import annotations
import hmac
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from .storage import database, event

router=APIRouter(prefix="/api/genesis/growth",tags=["Genesis Growth"])
PROGRAM_VERSION="growth-2026-11-18-v1"
MODEL_POOL=3_000_000

def initialize_growth():
    with database() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS genesis_growth_preferences(
            workspace_id text PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
            in_app_updates boolean NOT NULL DEFAULT true,
            email_updates boolean NOT NULL DEFAULT false,
            updated_at timestamptz NOT NULL DEFAULT now()
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS genesis_growth_presence(
            workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            active_date date NOT NULL,
            first_seen_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY(workspace_id,active_date)
        )""")
        db.execute("""CREATE INDEX IF NOT EXISTS genesis_growth_presence_date_idx
                      ON genesis_growth_presence(active_date)""")

def _auth(request:Request):
    from .main import _authentication
    return _authentication(request)

def _write(request:Request):
    from .main import _authentication,_write
    return _write(request,_authentication(request))

def _is_member(db,workspace):
    return bool(db.execute("""SELECT 1 FROM genesis_memberships
             WHERE workspace_id=%s AND season_id='season-zero'""",(workspace,)).fetchone())

@router.get("/program")
def program():
    return {
        "schema":"workforceos.genesis-growth.v1",
        "rules_version":PROGRAM_VERSION,
        "status":"RESEARCH_PROPOSAL_NOT_TOKEN_OFFER",
        "active_rewards":"INTERNAL_XP_ONLY",
        "wallet_required":False,
        "token_issued":False,"claimable_token_balance":False,
        "campaign":{"working_name":"Genesis Season Zero — Agent Economy",
                    "proposed_duration_days":90,"actual_start_at":None,
                    "tge_date_committed":False},
        "candidate_allocation":{"hypothetical_supply":100_000_000,
                    "hypothetical_community_pool":30_000_000,
                    "proposed_season_pool":MODEL_POOL,"approved":False,
                    "buckets":[
                       {"id":"participation","percent":40,"model_units":1_200_000},
                       {"id":"agent_utility","percent":25,"model_units":750_000},
                       {"id":"referrals","percent":15,"model_units":450_000},
                       {"id":"crews","percent":10,"model_units":300_000},
                       {"id":"contributions","percent":10,"model_units":300_000}
                    ]},
        "notice":"Season allocation is only a scenario. XP and engagement scores never guarantee tokens, conversion, cash or a distribution date."
    }

def _index(stats):
    """Bounded participation *insight*, not a season token eligibility calculation."""
    days=int(stats.get("daily_checkin",0))
    game=int(stats.get("genesis_daily_game",0))
    agent=int(stats.get("first_agent",0))
    feedback=int(stats.get("product_feedback",0))
    quiz=int(stats.get("agent_basics_quiz",0))
    referrals=int(stats.get("activated_referral",0))
    return {
      "total":min(20,days*2)+min(20,game*2)+min(25,agent*25)+
              min(15,referrals*5)+min(20,feedback*5+quiz*10),
      "components":{
        "return_days":min(20,days*2),"games":min(20,game*2),
        "agent_created":min(25,agent*25),"verified_referrals":min(15,referrals*5),
        "quests_feedback":min(20,feedback*5+quiz*10)
      },
      "label":"30-day engagement index (0–100), NOT token allocation or airdrop eligibility",
      "rules_version":PROGRAM_VERSION
    }

@router.get("/me")
def me(account=Depends(_auth)):
    workspace=account["workspace_id"]
    with database() as db:
        membership=_is_member(db,workspace)
        stats=db.execute("""SELECT kind,count(*)::integer AS n
           FROM participation_points
           WHERE workspace_id=%s AND created_at>=now()-interval '30 days'
           GROUP BY kind""",(workspace,)).fetchall()
        xp=db.execute("""SELECT COALESCE(sum(points),0)::integer AS total
           FROM participation_points WHERE workspace_id=%s""",(workspace,)).fetchone()
        invites=db.execute("""SELECT count(*)::integer AS total,
           count(*) FILTER (WHERE activated_at IS NOT NULL)::integer AS activated
           FROM participation_referrals WHERE inviter_workspace_id=%s""",(workspace,)).fetchone()
        preferences=db.execute("""SELECT in_app_updates,email_updates,updated_at
           FROM genesis_growth_preferences WHERE workspace_id=%s""",(workspace,)).fetchone()
        visits=db.execute("""SELECT count(*)::integer AS n
           FROM genesis_growth_presence WHERE workspace_id=%s
           AND active_date>=CURRENT_DATE-interval '29 days'""",(workspace,)).fetchone()
    counts={row["kind"]:row["n"] for row in stats}
    return {
       "joined":membership,"xp_total":int(xp["total"]),
       "observed_30d":{"daily_claims":counts.get("daily_checkin",0),
         "correct_daily_games":counts.get("genesis_daily_game",0),
         "first_agent_awards":counts.get("first_agent",0),
         "verified_inviter_awards":counts.get("activated_referral",0),
         "feedback_awards":counts.get("product_feedback",0),
         "recorded_app_visit_days":int(visits["n"]),
         "invited_registrations":int(invites["total"]),
         "activated_invited_workspaces":int(invites["activated"])},
       "engagement_index":_index(counts) if membership else _index({}),
       "preferences":{"in_app_updates":preferences["in_app_updates"] if preferences else True,
          "email_updates":preferences["email_updates"] if preferences else False},
       "email_delivery_active":False,"telegram_delivery_active":False,
       "token_allocation":None,"token_eligibility_confirmed":False,
       "notice":"Recorded activities are first-party events. This index is engagement only; proposed token pools are not approved or claimable."
    }

@router.post("/visit")
def record_visit(request:Request):
    account=_write(request)
    workspace=account["workspace_id"]
    with database() as db:
        if not _is_member(db,workspace):
            raise HTTPException(409,"JOIN_GENESIS_FIRST")
        row=db.execute("""INSERT INTO genesis_growth_presence(workspace_id,active_date)
            VALUES (%s,(now() AT TIME ZONE 'UTC')::date)
            ON CONFLICT(workspace_id,active_date) DO NOTHING
            RETURNING active_date""",(workspace,)).fetchone()
        if row:
            event(db,workspace,"genesis.daily_session_observed",None,PROGRAM_VERSION)
    return {"recorded":bool(row),"already_counted":not bool(row),
            "reward_xp":0,"token_eligibility":False}

class Preferences(BaseModel):
    in_app_updates:bool=True
    email_updates:bool=False

@router.post("/preferences")
def preferences(body:Preferences,request:Request):
    account=_write(request)
    workspace=account["workspace_id"]
    with database() as db:
        row=db.execute("""INSERT INTO genesis_growth_preferences
            (workspace_id,in_app_updates,email_updates)
            VALUES (%s,%s,%s)
            ON CONFLICT (workspace_id) DO UPDATE SET
             in_app_updates=EXCLUDED.in_app_updates,
             email_updates=EXCLUDED.email_updates,updated_at=now()
            RETURNING in_app_updates,email_updates,updated_at""",
            (workspace,body.in_app_updates,body.email_updates)).fetchone()
        event(db,workspace,"genesis.communication_preference_changed",None,
              "email_opt_in" if body.email_updates else "email_opt_out")
    return {"saved":True,"in_app_updates":row["in_app_updates"],
            "email_updates":row["email_updates"],
            "email_delivery_active":False,"notice":"Preference saved. External notification delivery has not been connected."}

@router.get("/operator/overview")
def overview(request:Request):
    actual=os.environ.get("WORKFORCE_SUPPORT_OPERATOR_KEY","")
    supplied=request.headers.get("X-Workforce-Support-Key","")
    if len(actual)<32 or not hmac.compare_digest(supplied,actual):
        raise HTTPException(404,"NOT_FOUND")
    with database() as db:
        metrics=db.execute("""WITH base AS (
             SELECT m.workspace_id,m.joined_at,
               EXISTS (SELECT 1 FROM participation_points p
                   WHERE p.workspace_id=m.workspace_id AND p.created_at>=m.joined_at) activated,
               EXISTS (SELECT 1 FROM participation_points p
                   WHERE p.workspace_id=m.workspace_id
                     AND p.created_at>=m.joined_at+interval '1 day'
                     AND p.created_at<m.joined_at+interval '2 days') returned_d1,
               EXISTS (SELECT 1 FROM participation_points p
                   WHERE p.workspace_id=m.workspace_id
                     AND p.created_at>=m.joined_at+interval '7 days'
                     AND p.created_at<m.joined_at+interval '8 days') returned_d7
             FROM genesis_memberships m WHERE m.season_id='season-zero')
             SELECT count(*)::integer members,
               count(*) FILTER(WHERE activated)::integer activated_members,
               count(*) FILTER(WHERE joined_at<=now()-interval '2 days')::integer eligible_d1,
               count(*) FILTER(WHERE joined_at<=now()-interval '2 days' AND returned_d1)::integer returned_d1,
               count(*) FILTER(WHERE joined_at<=now()-interval '8 days')::integer eligible_d7,
               count(*) FILTER(WHERE joined_at<=now()-interval '8 days' AND returned_d7)::integer returned_d7
             FROM base""").fetchone()
        active=db.execute("""SELECT
            count(DISTINCT workspace_id) FILTER(WHERE active_date=(now() AT TIME ZONE 'UTC')::date)::integer AS daily_active,
            count(DISTINCT workspace_id) FILTER(WHERE active_date>=(now() AT TIME ZONE 'UTC')::date-6)::integer AS weekly_active
            FROM genesis_growth_presence""").fetchone()
        opted=db.execute("""SELECT count(*) FILTER (WHERE email_updates)::integer AS opt_in
            FROM genesis_growth_preferences""").fetchone()
    return {"source":"FIRST_PARTY_POSTGRES_ONLY","metrics":{
      **{k:int(v) for k,v in metrics.items()},
      "observed_app_dau":int(active["daily_active"]),
      "observed_app_wau":int(active["weekly_active"]),
      "email_updates_opted_in":int(opted["opt_in"])},
      "d1_rate":round(metrics["returned_d1"]/metrics["eligible_d1"],4) if metrics["eligible_d1"] else None,
      "d7_rate":round(metrics["returned_d7"]/metrics["eligible_d7"],4) if metrics["eligible_d7"] else None,
      "caveat":"Only source-recorded events count; retention measures return XP in 24-hour windows after joining. Visit counts begin after growth tracking deployment. No users or transactions invented."}
