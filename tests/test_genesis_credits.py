"""Genesis WC: source-backed earned credit, persisted purchases and tenant separation.

Run with an actual PostgreSQL service (existing WorkforceOS customer-release CI).
No fake users, balances or transactions may be reported as production customers.
"""
import os,sys,unittest,uuid
from datetime import datetime,timezone
from pathlib import Path
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
os.environ["ENVIRONMENT"]="development"
from app.main import app
from app.storage import database,uid
from app.genesis_arcade import CHALLENGES

def headers(csrf=None):
    h={"X-Workforce-Request":"workspace","Content-Type":"application/json"}
    if csrf:h["X-CSRF-Token"]=csrf
    return h

class GenesisCreditsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=TestClient(app);cls.root.__enter__()
    @classmethod
    def tearDownClass(cls):cls.root.__exit__(None,None,None)

    def signup(self):
        client=TestClient(app)
        email="wc_"+uuid.uuid4().hex[:18]+"@example.org"
        response=client.post("/api/register",headers=headers(),json={
            "email":email,"password":"Correct-Season!12345","workspace_name":"WC Test"})
        self.assertEqual(response.status_code,200,response.text)
        return client,response.json()["csrf"],response.json()["account"]["workspace_id"]

    def test_credit_economy_is_source_verified_spendable_and_idempotent(self):
        a,csrf_a,owner=self.signup()
        b,csrf_b,other=self.signup()
        initial=a.get("/api/genesis/credits/me")
        self.assertEqual(initial.status_code,200,initial.text)
        self.assertEqual(initial.json()["balance"],0)
        self.assertFalse(initial.json()["issued_crypto_token"])
        self.assertFalse(initial.json()["redeemable"])
        self.assertFalse(initial.json()["transferable"])
        self.assertFalse(initial.json()["token_conversion_promised"])
        self.assertEqual(b.get("/api/genesis/credits/me").json()["balance"],0)
        self.assertEqual(a.post("/api/genesis/credits/purchase",json={"item_id":"pioneer_frame"},headers=headers()).status_code,403)
        self.assertEqual(a.post("/api/genesis/credits/purchase",json={"item_id":"pioneer_frame"},headers=headers(csrf_a)).status_code,409)

        join=a.post("/api/genesis/join",json={"acknowledge":True},headers=headers(csrf_a))
        self.assertEqual(join.status_code,200,join.text)
        self.assertEqual(a.get("/api/genesis/credits/me").json()["balance"],4)

        daily=a.post("/api/rewards/daily",json={},headers=headers(csrf_a))
        self.assertEqual(daily.status_code,200,daily.text)
        self.assertTrue(daily.json()["awarded"])
        self.assertEqual(a.get("/api/genesis/credits/me").json()["balance"],6)
        again=a.post("/api/rewards/daily",json={},headers=headers(csrf_a))
        self.assertFalse(again.json()["awarded"])
        self.assertEqual(a.get("/api/genesis/credits/me").json()["balance"],6)

        current=datetime.now(timezone.utc).date()
        question=a.get("/api/genesis/play/today").json()
        self.assertEqual(question["id"],current.isoformat())
        correct=CHALLENGES[current.toordinal()%len(CHALLENGES)][2]
        success=a.post("/api/genesis/play/answer",headers=headers(csrf_a),json={
            "challenge_id":question["id"],"choice_id":str(correct)})
        self.assertEqual(success.status_code,200,success.text)
        self.assertTrue(success.json()["awarded"])
        self.assertEqual(a.get("/api/genesis/credits/me").json()["balance"],9)
        replay=a.post("/api/genesis/play/answer",headers=headers(csrf_a),json={
            "challenge_id":question["id"],"choice_id":str(correct)})
        self.assertFalse(replay.json()["awarded"])
        self.assertEqual(a.get("/api/genesis/credits/me").json()["balance"],9)
        self.assertEqual(a.post("/api/genesis/credits/purchase",headers=headers(csrf_a),
                       json={"item_id":"pioneer_frame"}).status_code,409)

        quiz=a.post("/api/rewards/quiz",headers=headers(csrf_a),
                    json={"quiz_id":"agent-dna-basics-v1","answer_id":"b"})
        self.assertEqual(quiz.status_code,200,quiz.text)
        self.assertTrue(quiz.json()["awarded"])
        self.assertEqual(a.get("/api/genesis/credits/me").json()["balance"],13)

        bought=a.post("/api/genesis/credits/purchase",headers=headers(csrf_a),
                      json={"item_id":"pioneer_frame"})
        self.assertEqual(bought.status_code,200,bought.text)
        self.assertTrue(bought.json()["unlocked"])
        self.assertEqual(bought.json()["cost_wc"],10)
        self.assertEqual(bought.json()["balance_wc"],3)
        self.assertEqual(a.post("/api/genesis/credits/purchase",headers=headers(csrf_a),
                        json={"item_id":"pioneer_frame"}).status_code,409)
        self.assertEqual(a.post("/api/genesis/credits/purchase",headers=headers(csrf_a),
                        json={"item_id":"missing_item"}).status_code,404)
        wallet=a.get("/api/genesis/credits/me").json()
        self.assertIn("pioneer_frame",wallet["owned"])
        self.assertTrue(any(x["delta"]==-10 for x in wallet["history"]))
        self.assertTrue(any(x["kind"]=="genesis_daily_game" and x["delta"]==3 for x in wallet["history"]))
        self.assertEqual(b.get("/api/genesis/credits/me").json()["balance"],0)
        self.assertEqual(b.get("/api/genesis/credits/me").json()["owned"],[])
        self.assertEqual(a.get("/api/genesis/sandbox").json()["started"],False)
        self.assertNotIn("cash",wallet)
        self.assertEqual(sum(x["delta"] for x in wallet["history"]),wallet["balance"])

    def test_old_real_xp_is_reconciled_once_without_fabrication(self):
        a,csrf,tenant=self.signup()
        with database() as db:
            db.execute("""INSERT INTO participation_points
                (id,workspace_id,claim_key,kind,points)
                VALUES (%s,%s,%s,%s,%s)""",
                (uid("xp"),tenant,"historic:real_agent:" + uuid.uuid4().hex,"first_agent",20))
        first=a.get("/api/genesis/credits/me").json()
        second=a.get("/api/genesis/credits/me").json()
        self.assertEqual(first["balance"],8)
        self.assertEqual(second["balance"],8)
        self.assertEqual(len(first["history"]),1)
        self.assertEqual(len(second["history"]),1)
        self.assertEqual(self.root.get("/api/genesis/credits/me").status_code,401)
        self.assertEqual(self.root.post("/api/genesis/credits/purchase",
            headers=headers(),json={"item_id":"pioneer_frame"}).status_code,401)

if __name__=="__main__":unittest.main()
