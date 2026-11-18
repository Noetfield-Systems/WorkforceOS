"""First-party customer care acceptance: persistence, privacy, and OS outbox."""
import os
import sys
import uuid
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ["ENVIRONMENT"]="development"
from app.main import app

HEADERS={"X-Workforce-Request":"workspace","Content-Type":"application/json"}

class SupportLaunchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client=TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None,None,None)

    def test_public_help_and_truthful_commercial_status(self):
        ops=self.client.get("/help/operator")
        self.assertEqual(ops.status_code,200,ops.text)
        self.assertIn("noindex",ops.text)
        page=self.client.get("/help")
        self.assertEqual(page.status_code,200,page.text)
        for item in ("Join", "Report an issue", "Track", "100M", "30%", "$0.005"):
            self.assertIn(item.lower(),page.text.lower())
        config=self.client.get("/api/support/config")
        self.assertEqual(config.status_code,200)
        data=config.json()
        self.assertEqual(data["plans"]["free"],0)
        self.assertEqual(data["plans"]["team"],199)
        self.assertFalse(data["financial_offering_active"])
        self.assertFalse(data["crypto_checkout_ready"])
        self.assertEqual(data["os_queue"],"operator_polling_ready_not_autonomous_repair")

    def test_real_case_privacy_and_operator_event(self):
        email="support_"+uuid.uuid4().hex[:16]+"@example.org"
        data={"name":"Release QA","email":email,"category":"bug",
              "subject":"Genesis avatar jumps",
              "message":"The signup panel changes image size when toggled on desktop.",
              "page_path":"/genesis/app?token=should-not-be-stored"}
        missing_header=self.client.post("/api/support/cases",json=data)
        self.assertEqual(missing_header.status_code,403)
        created=self.client.post("/api/support/cases",json=data,headers=HEADERS)
        self.assertEqual(created.status_code,201,created.text)
        result=created.json()
        self.assertTrue(result["received"])
        self.assertEqual(result["status"],"RECEIVED")
        ref=result["id"]
        self.assertTrue(ref.startswith("sup_"))
        self.assertGreaterEqual(len(result["receipt"]),32)
        self.assertEqual(self.client.get("/api/support/cases/"+ref).status_code,404)
        bad=self.client.get("/api/support/cases/"+ref,headers={
          "X-Support-Receipt":"x"*50})
        self.assertEqual(bad.status_code,404)
        valid=self.client.get("/api/support/cases/"+ref,headers={
          "X-Support-Receipt":result["receipt"]})
        self.assertEqual(valid.status_code,200)
        self.assertEqual(valid.json()["category"],"bug")
        reply=self.client.post("/api/support/cases/"+ref+"/reply",
            json={"message":"Additional device details: Mac desktop with Safari."},
            headers={**HEADERS,"X-Support-Receipt":result["receipt"]})
        self.assertEqual(reply.status_code,201,reply.text)
        self.assertEqual(len(self.client.get("/api/support/cases/"+ref,
             headers={"X-Support-Receipt":result["receipt"]}).json()["messages"]),1)
        from app.storage import database
        with database() as db:
            row=db.execute("SELECT page_path,priority,receipt_hash FROM support_cases WHERE id=%s",(ref,)).fetchone()
        self.assertEqual(row["page_path"],"/genesis/app")
        self.assertEqual(row["priority"],"HIGH")
        self.assertNotEqual(row["receipt_hash"],result["receipt"])
        self.assertEqual(self.client.get("/api/support/operator/queue").status_code,404)
        key="QA-support-only-"+"z"*48
        previous=os.environ.get("WORKFORCE_SUPPORT_OPERATOR_KEY")
        os.environ["WORKFORCE_SUPPORT_OPERATOR_KEY"]=key
        try:
            queue=self.client.get("/api/support/operator/queue",headers={
              "X-Workforce-Support-Key":key})
            self.assertEqual(queue.status_code,200)
            event=next(x for x in queue.json()["events"] if x["case_id"]==ref)
            self.assertEqual(event["state"],"QUEUED")
            self.assertFalse(queue.json()["auto_repair_enabled"])
            done=self.client.post("/api/support/operator/events/"+str(event["event_id"]),
              json={"status":"INVESTIGATING","note":"Triage assigned","customer_visible":True},
              headers={**HEADERS,"X-Workforce-Support-Key":key})
            self.assertEqual(done.status_code,200,done.text)
            again=self.client.post("/api/support/operator/events/"+str(event["event_id"]),
              json={"status":"RESOLVED"},headers={**HEADERS,"X-Workforce-Support-Key":key})
            self.assertEqual(again.status_code,404)
        finally:
            if previous is None:os.environ.pop("WORKFORCE_SUPPORT_OPERATOR_KEY",None)
            else:os.environ["WORKFORCE_SUPPORT_OPERATOR_KEY"]=previous
        updated=self.client.get("/api/support/cases/"+ref,headers={
          "X-Support-Receipt":result["receipt"]})
        self.assertEqual(updated.json()["status"],"INVESTIGATING")
        self.assertEqual(updated.json()["messages"][-1]["body"],"Triage assigned")

    def test_bad_category_honeypot_and_no_admin_exposure(self):
        body={"name":"QA Client","email":"qa"+uuid.uuid4().hex[:9]+"@example.org",
             "category":"impossible","subject":"Test request",
             "message":"This message is long enough to test validation."}
        self.assertEqual(self.client.post("/api/support/cases",json=body,headers=HEADERS).status_code,400)
        body["category"]="feature";body["website"]="some-bot-website"
        res=self.client.post("/api/support/cases",json=body,headers=HEADERS)
        self.assertEqual(res.status_code,201)
        self.assertNotIn("id",res.json())
