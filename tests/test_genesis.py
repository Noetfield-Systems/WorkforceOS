"""Source-verified Genesis Season Zero acceptance.

All tests exercise real PostgreSQL and the current app API.
No fabricated token, financial balance, airdrop or wallet claim.
"""
import os
import sys
import uuid
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
os.environ["ENVIRONMENT"]="development"
from app.main import app
from app.storage import database

def headers(csrf=None):
    h={"Content-Type":"application/json","X-Workforce-Request":"workspace"}
    if csrf:h["X-CSRF-Token"]=csrf
    return h

class GenesisTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=TestClient(app)
        cls.root.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.root.__exit__(None,None,None)

    def signup(self,referral=None):
        client=TestClient(app)
        data={"email":"genesis_"+uuid.uuid4().hex[:20]+"@example.org",
              "password":"Correct-Horse-123456","workspace_name":"Genesis Test"}
        if referral:data["referral_code"]=referral
        response=client.post("/api/register",headers=headers(),json=data)
        self.assertEqual(response.status_code,200,response.text)
        return client,response.json()["csrf"]

    def test_public_rules_and_pages_truthful(self):
        program=self.root.get("/api/genesis/program")
        self.assertEqual(program.status_code,200,program.text)
        p=program.json()
        self.assertEqual(p["id"],"season-zero")
        self.assertEqual(p["phase"],"OPEN_OFFCHAIN")
        self.assertEqual(p["join_bonus_xp"],10)
        self.assertEqual(len(p["quests"]),6)
        self.assertFalse(p["wallet_required"])
        self.assertFalse(p["token_minted"])
        self.assertFalse(p["airdrop_right"])
        self.assertFalse(p["benefit_guaranteed"])
        self.assertEqual(p["scenario"]["scenario_total_units"],100_000_000)
        self.assertEqual(p["scenario"]["units_created"],0)
        self.assertIsNone(p["scenario"]["ticker"])
        self.assertFalse(p["scenario"]["claim_active"])
        self.assertFalse(p["scenario"]["sale_active"])
        self.assertIsNone(p["scenario"]["xp_to_token_rate"])
        self.assertEqual(sum(x["percent"] for x in p["scenario"]["pool_scenarios"]),100)
        for target,contents in [
            ("/genesis",["genesis-quest-grid","join-button","leaderboard-rows","token-pools",
                         "/static/genesis.js","/static/genesis.css","/genesis/whitepaper"]),
            ("/genesis/whitepaper",["Tokenomics","Season Zero","/genesis","100,000,000"]),
            ("/genesis/docs",["FAQ","airdrop","/genesis/whitepaper"])
        ]:
            with self.subTest(page=target):
                response=self.root.get(target)
                self.assertEqual(response.status_code,200,response.text)
                for item in contents:self.assertIn(item,response.text)
        for asset in ("/static/genesis.js","/static/genesis.css"):
            self.assertEqual(self.root.get(asset).status_code,200)
        self.assertEqual(self.root.get("/api/genesis/me").status_code,401)
        for page in ("/","/marketplace","/agent-studio","/rewards"):
            self.assertIn('href="/genesis"',self.root.get(page).text)

    def test_opt_in_is_real_idempotent_and_csrf_protected(self):
        member,csrf=self.signup()
        baseline=self.root.get("/api/genesis/overview").json()["joined_workspaces"]
        anonymous=self.root.post("/api/genesis/join",headers=headers(),json={"acknowledge":True})
        self.assertEqual(anonymous.status_code,401)
        self.assertFalse(member.get("/api/genesis/me").json()["joined"])
        self.assertEqual(member.get("/api/genesis/me").json()["genesis_xp"],0)
        self.assertEqual(member.post("/api/genesis/join",json={"acknowledge":True},
                                     headers=headers()).status_code,403)
        self.assertEqual(member.post("/api/genesis/join",json={"acknowledge":False},
                                     headers=headers(csrf)).status_code,422)
        good=member.post("/api/genesis/join",json={"acknowledge":True},headers=headers(csrf))
        self.assertEqual(good.status_code,200,good.text)
        self.assertTrue(good.json()["new_member"])
        self.assertEqual(good.json()["xp_awarded"],10)
        duplicate=member.post("/api/genesis/join",json={"acknowledge":True},headers=headers(csrf))
        self.assertEqual(duplicate.status_code,200)
        self.assertFalse(duplicate.json()["new_member"])
        self.assertEqual(duplicate.json()["xp_awarded"],0)
        self.assertEqual(self.root.get("/api/genesis/overview").json()["joined_workspaces"],baseline+1)
        mine=member.get("/api/genesis/me").json()
        self.assertTrue(mine["joined"])
        self.assertEqual(mine["genesis_xp"],10)
        self.assertEqual(mine["lifetime_xp"],10)
        self.assertTrue(mine["member"].startswith("Member "))
        self.assertFalse(mine["eligible_for_guaranteed_token"])
        self.assertEqual(len([x for x in mine["history"] if x["kind"]=="genesis_join"]),1)
        with database() as db:
            entry=db.execute("""SELECT count(*) AS n FROM participation_points
                WHERE kind='genesis_join' AND claim_key='genesis:season-zero:join'
                AND workspace_id=(SELECT workspace_id FROM genesis_memberships
                    ORDER BY joined_at DESC LIMIT 1)""").fetchone()
        self.assertGreaterEqual(entry["n"],1)

    def test_agent_actions_and_pseudonymous_standings(self):
        inviter,csrf_inviter=self.signup()
        other,csrf_other=self.signup()
        self.assertEqual(inviter.post("/api/genesis/join",json={"acknowledge":True},
                                     headers=headers(csrf_inviter)).status_code,200)
        self.assertEqual(other.post("/api/genesis/join",json={"acknowledge":True},
                                   headers=headers(csrf_other)).status_code,200)
        make=inviter.post("/api/agent-dna",headers=headers(csrf_inviter),
                          json={"preset_id":"community_builder"})
        self.assertEqual(make.status_code,200,make.text)
        mine=inviter.get("/api/genesis/me").json()
        self.assertEqual(mine["genesis_xp"],30)
        self.assertTrue(any(x["kind"]=="first_agent" for x in mine["history"]))
        self.assertEqual(other.get("/api/genesis/me").json()["genesis_xp"],10)
        board=self.root.get("/api/genesis/leaderboard").json()
        self.assertGreaterEqual(len(board["leaders"]),2)
        scores=[x["genesis_xp"] for x in board["leaders"]]
        self.assertEqual(scores,sorted(scores,reverse=True))
        serialized=str(board)
        self.assertNotIn("@example.org",serialized)
        self.assertNotIn("workspace_id",serialized)
        self.assertNotIn("invite_code",serialized)

    def test_verified_referral_counts_only_after_real_first_agent(self):
        inviter,csrf=self.signup()
        inviter.post("/api/genesis/join",json={"acknowledge":True},headers=headers(csrf))
        link=inviter.post("/api/rewards/invite",json={},headers=headers(csrf)).json()
        newcomer,csfr_new=self.signup(referral=link["code"])
        newcomer.post("/api/genesis/join",json={"acknowledge":True},
                      headers=headers(csfr_new))
        self.assertEqual(inviter.get("/api/genesis/me").json()["genesis_xp"],10)
        self.assertEqual(newcomer.get("/api/genesis/me").json()["genesis_xp"],10)
        first=newcomer.post("/api/agent-dna",headers=headers(csfr_new),
                            json={"preset_id":"lyra"})
        self.assertEqual(first.status_code,200,first.text)
        self.assertEqual(inviter.get("/api/genesis/me").json()["genesis_xp"],35)
        self.assertEqual(newcomer.get("/api/genesis/me").json()["genesis_xp"],40)
        self.assertEqual(inviter.get("/api/rewards/referrals").json()["activated_workspaces"],1)
        second=newcomer.post("/api/agent-dna",headers=headers(csfr_new),
                             json={"preset_id":"orion"})
        self.assertEqual(second.status_code,200)
        self.assertEqual(inviter.get("/api/genesis/me").json()["genesis_xp"],35)
        self.assertEqual(newcomer.get("/api/genesis/me").json()["genesis_xp"],40)

if __name__=="__main__":
    unittest.main()
