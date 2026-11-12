"""Opportunity OS integration: real persistence, operator authorization, receipt honesty."""
import os
import unittest
import uuid

from fastapi.testclient import TestClient

os.environ["ENVIRONMENT"]="development"
os.environ["OPPORTUNITY_OPERATOR_KEY"]="test-opportunity-operator-key-"+("a"*40)
from app.main import app

KEY=os.environ["OPPORTUNITY_OPERATOR_KEY"]
HEADERS={"Content-Type":"application/json","X-Workforce-Request":"workspace"}


class OpportunitySystemTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client=TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None,None,None)

    def new_case(self,**overrides):
        identity=uuid.uuid4().hex[:12]
        payload={
            "full_name":"QA Opportunity Contact",
            "email":"opp_"+identity+"@example.org",
            "organization":"QA Company",
            "source":"linkedin",
            "source_url":"https://www.linkedin.com/in/qa/",
            "source_context":"A genuine QA-only intake request for API behavior validation.",
            "kind":"partnership",
            "intent":"We need a working, evidence-led collaboration funnel with a concrete handoff.",
            "venture":"noetfield",
            "participant":"hybrid"
        }
        payload.update(overrides)
        result=self.client.post("/api/opportunity-os/cases",json=payload,headers=HEADERS)
        self.assertEqual(result.status_code,201,result.text)
        self.assertIn("tracking_token",result.json())
        self.assertNotIn("assigned",result.json())
        return result.json()

    def test_persian_site_loads(self):
        r=self.client.get("/opportunity-os/")
        self.assertEqual(r.status_code,200,r.text)
        self.assertIn('lang="fa"',r.text)
        self.assertIn('dir="rtl"',r.text)
        self.assertIn("ثبت فرصت",r.text)
        self.assertEqual(self.client.get("/static/opportunity-os.js").status_code,200)
        self.assertEqual(self.client.get("/static/opportunity-os.css").status_code,200)

    def test_source_owned_case_and_private_operator(self):
        created=self.new_case()
        case_id=created["case"]["id"]
        token=created["tracking_token"]
        self.assertEqual(created["case"]["status"],"new")
        self.assertEqual(created["case"]["owner"],"intake_queue")
        self.assertTrue(created["case"]["next_date"])
        self.assertEqual(created["case"]["route"],"مسیر شراکت")
        self.assertEqual(created["case"]["verification_state"],"NOT_INDEPENDENTLY_VERIFIED")
        unauth=self.client.get("/api/opportunity-os/operator/cases")
        self.assertEqual(unauth.status_code,403)
        self.assertEqual(self.client.get("/api/opportunity-os/cases/"+case_id+"/track",
                             headers={"X-Opportunity-Tracking-Token":"invalid"}).status_code,404)
        tracked=self.client.get("/api/opportunity-os/cases/"+case_id+"/track",
                                headers={"X-Opportunity-Tracking-Token":token})
        self.assertEqual(tracked.status_code,200,tracked.text)
        self.assertNotIn("email",tracked.json()["case"])
        authorized={"X-Opportunity-Operator-Key":KEY}
        listing=self.client.get("/api/opportunity-os/operator/cases?kind=partnership",
                                headers=authorized)
        self.assertEqual(listing.status_code,200,listing.text)
        self.assertTrue(any(x["id"]==case_id for x in listing.json()["cases"]))
        denied=self.client.patch("/api/opportunity-os/operator/cases/"+case_id,
                                 headers={**authorized,**HEADERS},
                                 json={"outcome":"partner"})
        self.assertEqual(denied.status_code,422,denied.text)
        updated=self.client.patch("/api/opportunity-os/operator/cases/"+case_id,
                                  headers={**authorized,**HEADERS},
                                  json={"owner":"Human owner QA","status":"in_review",
                                        "stage":"qualifying","match_quality":"medium",
                                        "next_action":"Confirm candidate introduction."})
        self.assertEqual(updated.status_code,200,updated.text)
        self.assertEqual(updated.json()["case"]["owner"],"Human owner QA")
        self.assertEqual(updated.json()["case"]["verification_state"],"NOT_INDEPENDENTLY_VERIFIED")
        filtered=self.client.get("/api/opportunity-os/operator/cases?stage=qualifying&match_quality=medium&owner=Human%20owner%20QA&due=scheduled",
                                 headers=authorized)
        self.assertEqual(filtered.status_code,200,filtered.text)
        self.assertTrue(any(x["id"]==case_id for x in filtered.json()["cases"]))
        premature_win=self.client.patch("/api/opportunity-os/operator/cases/"+case_id,
                                        headers={**authorized,**HEADERS},json={"status":"won"})
        self.assertEqual(premature_win.status_code,422,premature_win.text)
        record=self.client.post("/api/opportunity-os/operator/cases/"+case_id+"/events",
                                headers={**authorized,**HEADERS},
                                json={"event_type":"feedback","body":"Test review logged with actual API event."})
        self.assertEqual(record.status_code,200,record.text)
        detail=self.client.get("/api/opportunity-os/operator/cases/"+case_id,headers=authorized)
        self.assertTrue(any(e["event_type"]=="feedback" for e in detail.json()["events"]))
        with_link=self.client.patch("/api/opportunity-os/operator/cases/"+case_id,
                                    headers={**authorized,**HEADERS},
                                    json={"outcome":"partner",
                                          "outcome_evidence":"https://example.org/sample-evidence",
                                          "stage":"converted"})
        self.assertEqual(with_link.status_code,200,with_link.text)
        self.assertFalse(with_link.json()["independently_verified"])
        self.assertEqual(with_link.json()["case"]["verification_state"],
                         "NOT_INDEPENDENTLY_VERIFIED")
        won=self.client.patch("/api/opportunity-os/operator/cases/"+case_id,
                              headers={**authorized,**HEADERS},json={"status":"won"})
        self.assertEqual(won.status_code,200,won.text)
        self.assertEqual(won.json()["case"]["verification_state"],
                         "NOT_INDEPENDENTLY_VERIFIED")

    def test_rate_limit_rejection_survives_transaction(self):
        # The sixth submission for one identity is blocked on the disposable CI database.
        email="ratelimit_"+uuid.uuid4().hex[:12]+"@example.org"
        payload={
            "full_name":"QA Repeated Intake","email":email,"source":"direct",
            "source_context":"Automated rate limit contract validation, test data only.",
            "kind":"customer",
            "intent":"Test repeated submissions for the same identity to reject a sixth request."
        }
        for _ in range(5):
            response=self.client.post("/api/opportunity-os/cases",json=payload,headers=HEADERS)
            self.assertEqual(response.status_code,201,response.text)
        denied=self.client.post("/api/opportunity-os/cases",json=payload,headers=HEADERS)
        self.assertEqual(denied.status_code,429,denied.text)
        denied_again=self.client.post("/api/opportunity-os/cases",json=payload,headers=HEADERS)
        self.assertEqual(denied_again.status_code,429,denied_again.text)

    def test_invalid_source_and_fake_handoff_rejected(self):
        payload={
            "full_name":"QA Contact",
            "email":"qa_"+uuid.uuid4().hex[:12]+"@example.org",
            "source":"nonsense","source_context":"Actual text from a sample test case.",
            "kind":"partnership","intent":"This is an API validation scenario, not a real external collaboration."
        }
        r=self.client.post("/api/opportunity-os/cases",json=payload,headers=HEADERS)
        self.assertEqual(r.status_code,422,r.text)
        created=self.new_case()
        cid=created["case"]["id"]
        headers={**HEADERS,"X-Opportunity-Operator-Key":KEY}
        denied=self.client.patch("/api/opportunity-os/operator/cases/"+cid,headers=headers,
                                 json={"collaboration":"handoff_recorded"})
        self.assertEqual(denied.status_code,422,denied.text)
        denied=self.client.patch("/api/opportunity-os/operator/cases/"+cid,headers=headers,
                                 json={"verification_state":"VERIFIED"})
        self.assertEqual(denied.status_code,422,denied.text)
        current=self.client.get("/api/opportunity-os/operator/cases/"+cid,
                                headers={"X-Opportunity-Operator-Key":KEY})
        self.assertEqual(current.json()["case"]["verification_state"],
                         "NOT_INDEPENDENTLY_VERIFIED")


if __name__=="__main__":
    unittest.main()
