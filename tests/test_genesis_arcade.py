"""Genesis app: auth, daily play, XP source ledger and zero-value demo economy."""
import os,sys,uuid,unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
os.environ["ENVIRONMENT"]="development"
from app.main import app
from app.storage import database
from app import rewards
from app.genesis_arcade import CHALLENGES

def headers(csrf=None):
    h={"Content-Type":"application/json","X-Workforce-Request":"workspace"}
    if csrf:h["X-CSRF-Token"]=csrf
    return h

class GenesisArcadeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=TestClient(app)
        cls.root.__enter__()
    @classmethod
    def tearDownClass(cls):cls.root.__exit__(None,None,None)

    def signup(self,referral=None):
        client=TestClient(app)
        body={"email":"arcade_"+uuid.uuid4().hex[:16]+"@example.org",
              "password":"Strong-Pass-123456","workspace_name":"Arcade QA"}
        if referral:body["referral_code"]=referral
        r=client.post("/api/register",json=body,headers=headers())
        self.assertEqual(r.status_code,200,r.text)
        return client,r.json()["csrf"]

    def join(self,client,csrf):
        r=client.post("/api/genesis/join",json={"acknowledge":True},headers=headers(csrf))
        self.assertEqual(r.status_code,200,r.text)

    def op(self,client,csrf,action,amount,category=None,id=None):
        return client.post("/api/genesis/sandbox/operate",
            headers=headers(csrf),json={"action":action,"amount":amount,
            "request_id":id or uuid.uuid4().hex,"category":category})

    def test_inside_member_app_and_protected_endpoints(self):
        for path in ("/genesis/app","/genesis/app/","/static/genesis-app.js","/static/genesis-app.css"):
            r=self.root.get(path)
            self.assertEqual(r.status_code,200,r.text[:200])
        page=self.root.get("/genesis/app").text
        for element in ("auth-form","mode-register","mode-login","member-app","claim",
                        "answer","invite-create","start-demo","buy","sell","stake","unstake","invest"):
            self.assertIn('id="'+element+'"',page)
        for path in ("/api/genesis/play/today","/api/genesis/daily-state","/api/genesis/sandbox"):
            self.assertEqual(self.root.get(path).status_code,401,path)
        a,csrf=self.signup()
        self.assertEqual(a.get("/api/genesis/sandbox").json()["started"],False)
        self.assertEqual(a.post("/api/genesis/sandbox/start",headers=headers(csrf),json={}).status_code,409)
        self.assertEqual(a.post("/api/genesis/play/answer",headers=headers(csrf),
           json={"challenge_id":datetime.now(timezone.utc).date().isoformat(),"choice_id":"0"}).status_code,200 if
           str(datetime.now(timezone.utc).date().toordinal()%len(CHALLENGES))!="0" else 409)

    def test_daily_game_once_and_independent_member_records(self):
        a,csrf=self.signup()
        b,csrf_b=self.signup()
        self.join(a,csrf)
        challenge=a.get("/api/genesis/play/today").json()
        self.assertEqual(len(challenge["choices"]),4)
        self.assertFalse(challenge["played"])
        self.assertEqual(challenge["reward_xp"],8)
        self.assertNotIn("correct",challenge)
        idx=datetime.now(timezone.utc).date().toordinal()%len(CHALLENGES)
        correct=CHALLENGES[idx][2]
        wrong=a.post("/api/genesis/play/answer",headers=headers(csrf),json={
            "challenge_id":challenge["id"],"choice_id":str((correct+1)%4)})
        self.assertEqual(wrong.status_code,200,wrong.text)
        self.assertFalse(wrong.json()["correct"])
        self.assertEqual(a.get("/api/genesis/me").json()["genesis_xp"],10)
        missing_csrf=a.post("/api/genesis/play/answer",headers=headers(),json={
            "challenge_id":challenge["id"],"choice_id":str(correct)})
        self.assertEqual(missing_csrf.status_code,403)
        good=a.post("/api/genesis/play/answer",headers=headers(csrf),json={
            "challenge_id":challenge["id"],"choice_id":str(correct)})
        self.assertEqual(good.status_code,200,good.text)
        self.assertEqual(good.json()["xp"],8)
        self.assertTrue(a.get("/api/genesis/play/today").json()["played"])
        repeat=a.post("/api/genesis/play/answer",headers=headers(csrf),json={
            "challenge_id":challenge["id"],"choice_id":str(correct)})
        self.assertFalse(repeat.json()["awarded"])
        self.assertEqual(a.get("/api/genesis/me").json()["genesis_xp"],18)
        self.assertEqual(b.get("/api/genesis/me").json()["genesis_xp"],0)
        expired=a.post("/api/genesis/play/answer",headers=headers(csrf),json={
            "challenge_id":"1999-12-31","choice_id":str(correct)})
        self.assertEqual(expired.status_code,409)

    def test_streak_milestones_and_daily_claim_are_idempotent(self):
        a,csrf=self.signup();self.join(a,csrf)
        tenant=a.get("/api/session").json()["account"]["workspace_id"]
        today=datetime.now(timezone.utc).date()
        with database() as db:
            for delta in (1,2):
                dt=(today-timedelta(days=delta)).isoformat()
                rewards.award(db,tenant,kind="daily_checkin",claim_key="daily:"+dt,points=5)
        first=a.post("/api/rewards/daily",headers=headers(csrf),json={})
        self.assertEqual(first.status_code,200,first.text)
        self.assertEqual(first.json()["streak_days"],3)
        self.assertEqual(first.json()["streak_bonus_xp"],4)
        self.assertEqual(first.json()["points"],9)
        second=a.post("/api/rewards/daily",headers=headers(csrf),json={})
        self.assertEqual(second.status_code,200)
        self.assertFalse(second.json()["awarded"])
        self.assertEqual(second.json()["streak_bonus_xp"],0)
        self.assertEqual(a.get("/api/genesis/daily-state").json()["streak_days"],3)

    def test_demo_trade_stake_invest_and_isolation(self):
        a,csrf=self.signup();b,csrf_b=self.signup()
        self.join(a,csrf);self.join(b,csrf_b)
        self.assertEqual(a.post("/api/genesis/sandbox/start",headers=headers(),json={}).status_code,403)
        start=a.post("/api/genesis/sandbox/start",headers=headers(csrf),json={})
        self.assertEqual(start.status_code,200,start.text)
        self.assertTrue(start.json()["new"])
        self.assertEqual(start.json()["credits"],1000)
        self.assertEqual(start.json()["units"],100)
        self.assertTrue(start.json()["not_redeemable"])
        again=a.post("/api/genesis/sandbox/start",headers=headers(csrf),json={})
        self.assertFalse(again.json()["new"])
        self.assertEqual(again.json()["units"],100)
        same=uuid.uuid4().hex
        bought=self.op(a,csrf,"buy",10,id=same)
        self.assertEqual(bought.status_code,200,bought.text)
        self.assertEqual(bought.json()["credits"],900)
        self.assertEqual(bought.json()["units"],110)
        duplicate=self.op(a,csrf,"buy",10,id=same).json()
        self.assertTrue(duplicate["replayed"])
        self.assertEqual(duplicate["units"],110)
        sold=self.op(a,csrf,"sell",5)
        self.assertEqual(sold.json()["credits"],950)
        self.assertEqual(sold.json()["units"],105)
        lock=self.op(a,csrf,"stake",10)
        self.assertEqual(lock.json()["units"],95)
        self.assertEqual(lock.json()["staked_units"],10)
        early=self.op(a,csrf,"unstake",10)
        self.assertEqual(early.status_code,409,early.text)
        invalid=self.op(a,csrf,"invest",12,category="fake-yield")
        self.assertEqual(invalid.status_code,422)
        allocated=self.op(a,csrf,"invest",50,category="agent_creators")
        self.assertEqual(allocated.status_code,200,allocated.text)
        self.assertEqual(allocated.json()["credits"],900)
        self.assertTrue(any(p["category"]=="agent_creators" for p in allocated.json()["positions"]))
        self.assertEqual(b.get("/api/genesis/sandbox").json()["started"],False)
        self.assertEqual(a.get("/api/genesis/me").json()["genesis_xp"],10)
        self.assertEqual(b.get("/api/genesis/me").json()["genesis_xp"],10)
        self.assertEqual(self.op(a,csrf,"buy",500).status_code,409)
        self.assertEqual(a.get("/api/genesis/sandbox").json()["credits"],900)

if __name__=="__main__":unittest.main()
