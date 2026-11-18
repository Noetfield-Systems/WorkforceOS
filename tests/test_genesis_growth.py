"""First-party Genesis Growth: genuine ledger, consent, cohort and case boundaries."""
import os,sys,unittest,uuid
from pathlib import Path
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ["ENVIRONMENT"]="development"
from app.main import app

def headers(csrf=None):
    h={"Content-Type":"application/json","X-Workforce-Request":"workspace"}
    if csrf:h["X-CSRF-Token"]=csrf
    return h

class GenesisGrowthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=TestClient(app);cls.root.__enter__()
    @classmethod
    def tearDownClass(cls):
        cls.root.__exit__(None,None,None)
    def signup(self):
        c=TestClient(app)
        r=c.post("/api/register",headers=headers(),json={
          "email":"growth_"+uuid.uuid4().hex[:18]+"@example.org",
          "password":"GoodLongPass!12982","workspace_name":"Genesis Growth QA"})
        self.assertEqual(r.status_code,200,r.text)
        return c,r.json()["csrf"]
    def test_program_and_private_auth(self):
        d=self.root.get("/api/genesis/growth/program").json()
        self.assertEqual(d["status"],"RESEARCH_PROPOSAL_NOT_TOKEN_OFFER")
        self.assertEqual(d["candidate_allocation"]["proposed_season_pool"],3000000)
        self.assertFalse(d["candidate_allocation"]["approved"])
        self.assertFalse(d["token_issued"])
        for route in ("/api/genesis/growth/me","/api/genesis/growth/operator/overview"):
            self.assertIn(self.root.get(route).status_code,(401,404))
        page=self.root.get("/genesis/app")
        self.assertEqual(page.status_code,200)
        for id in ("growth-index","growth-email","growth-save","growth-claims"):
            self.assertIn('id="'+id+'"',page.text)
    def test_join_visit_xp_and_preferences(self):
        c,csrf=self.signup()
        self.assertEqual(c.post("/api/genesis/growth/visit",json={},headers=headers(csrf)).status_code,409)
        r=c.post("/api/genesis/join",headers=headers(csrf),json={"acknowledge":True})
        self.assertEqual(r.status_code,200,r.text)
        first=c.post("/api/genesis/growth/visit",headers=headers(csrf),json={})
        self.assertEqual(first.status_code,200,first.text)
        self.assertTrue(first.json()["recorded"])
        second=c.post("/api/genesis/growth/visit",headers=headers(csrf),json={})
        self.assertFalse(second.json()["recorded"])
        self.assertTrue(second.json()["already_counted"])
        self.assertEqual(first.json()["reward_xp"],0)
        self.assertEqual(c.post("/api/genesis/growth/preferences",json={
            "email_updates":True,"in_app_updates":False},headers=headers()).status_code,403)
        changed=c.post("/api/genesis/growth/preferences",headers=headers(csrf),json={
            "email_updates":True,"in_app_updates":False})
        self.assertEqual(changed.status_code,200,changed.text)
        self.assertTrue(changed.json()["saved"])
        self.assertFalse(changed.json()["email_delivery_active"])
        me=c.get("/api/genesis/growth/me")
        self.assertEqual(me.status_code,200,me.text)
        d=me.json()
        self.assertTrue(d["joined"])
        self.assertEqual(d["observed_30d"]["recorded_app_visit_days"],1)
        self.assertTrue(d["preferences"]["email_updates"])
        self.assertFalse(d["preferences"]["in_app_updates"])
        self.assertIsNone(d["token_allocation"])
        self.assertFalse(d["token_eligibility_confirmed"])
        self.assertGreaterEqual(d["engagement_index"]["total"],0)
        self.assertLessEqual(d["engagement_index"]["total"],100)
        daily=c.post("/api/rewards/daily",json={},headers=headers(csrf))
        self.assertEqual(daily.status_code,200,daily.text)
        updated=c.get("/api/genesis/growth/me").json()
        self.assertEqual(updated["observed_30d"]["daily_claims"],1)
        self.assertGreater(updated["engagement_index"]["total"],0)
        self.assertEqual(c.post("/api/genesis/growth/preferences",
            headers=headers(csrf),json={"email_updates":False,"in_app_updates":True}).status_code,200)
        self.assertFalse(c.get("/api/genesis/growth/me").json()["preferences"]["email_updates"])
    def test_aggregated_operator_proof_protected(self):
        self.assertEqual(self.root.get("/api/genesis/growth/operator/overview").status_code,404)
        previous=os.environ.get("WORKFORCE_SUPPORT_OPERATOR_KEY")
        secret="QA-long-support-key-"+uuid.uuid4().hex+uuid.uuid4().hex
        os.environ["WORKFORCE_SUPPORT_OPERATOR_KEY"]=secret
        try:
            r=self.root.get("/api/genesis/growth/operator/overview",
                  headers={"X-Workforce-Support-Key":secret})
            self.assertEqual(r.status_code,200,r.text)
            d=r.json()
            self.assertEqual(d["source"],"FIRST_PARTY_POSTGRES_ONLY")
            self.assertIn("members",d["metrics"])
            self.assertIn("observed_app_dau",d["metrics"])
            self.assertNotIn("email",d["metrics"])
            self.assertIsNone(d["d7_rate"]) if d["metrics"]["eligible_d7"]==0 else None
            bad=self.root.get("/api/genesis/growth/operator/overview",
                headers={"X-Workforce-Support-Key":"invalid"})
            self.assertEqual(bad.status_code,404)
        finally:
            if previous is None:os.environ.pop("WORKFORCE_SUPPORT_OPERATOR_KEY",None)
            else:os.environ["WORKFORCE_SUPPORT_OPERATOR_KEY"]=previous
