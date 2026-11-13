"""Founder Connect E2E: actual database cases, evidence-led transitions and privacy."""
import os
import unittest
import uuid

from fastapi.testclient import TestClient

os.environ["ENVIRONMENT"] = "development"
os.environ.setdefault("OPPORTUNITY_OPERATOR_KEY", "test-people-operator-" + "a" * 36)
from app.main import app
from app.storage import database

HEADERS = {"X-Workforce-Request": "workspace", "Content-Type": "application/json"}
OPERATOR = {"X-Opportunity-Operator-Key": os.environ["OPPORTUNITY_OPERATOR_KEY"]}

class PeopleOperationsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def submit(self):
        body={
          "full_name":"Real Applicant QA","email":f"qa-{uuid.uuid4().hex[:20]}@example.org",
          "lane":"freelancer","focus":"engineering",
          "skills":"Python, PostgreSQL, typescript and code review",
          "availability":"project","proposal":"Deliver a scoped API endpoint with tests and reviewable code.",
          "location":"Vancouver, Canada","languages":"English, Persian",
          "time_commitment":"10_20h","collaboration_model":"project",
          "rate_expectation":"CAD 100/hr","project_preference":"AI and software",
          "desired_role":"Backend engineer",
          "collaboration_goal":"Build useful products with real teammates",
          "source_message":"We connected via LinkedIn about engineering collaboration",
          "source":"linkedin","contact_consent":True,
        }
        res=self.client.post("/api/collaborate/apply",json=body,headers=HEADERS)
        self.assertEqual(res.status_code,201,res.text)
        return body,res.json()

    def test_public_entry_and_operator_permissions(self):
        self.assertEqual(self.client.get("/connect?lang=fa").status_code,200)
        page=self.client.get("/connect/desk")
        self.assertEqual(page.status_code,200)
        self.assertIn("میز عملیاتی",page.text)
        self.assertEqual(self.client.get("/api/collaborate/operator/people").status_code,403)
        self.assertEqual(self.client.get("/static/connect-desk.js").status_code,200)

    def test_real_profile_review_references_and_follow_up(self):
        profile,registered=self.submit()
        case_id=registered["case"]["id"]; token=registered["tracking_token"]
        with database() as db:
            row=db.execute("""SELECT location,languages,time_commitment,collaboration_model,
                 rate_expectation,project_preference,desired_role,collaboration_goal,
                 source_message FROM collaboration_applications WHERE case_id=%s""",
                 (case_id,)).fetchone()
        self.assertEqual(row["location"],profile["location"])
        self.assertEqual(row["source_message"],profile["source_message"])
        people=self.client.get("/api/collaborate/operator/people?q=Real%20Applicant",headers=OPERATOR)
        self.assertEqual(people.status_code,200,people.text)
        self.assertTrue(any(c["case_id"]==case_id for c in people.json()["cases"]))
        detail_url="/api/collaborate/operator/people/"+case_id
        detail=self.client.get(detail_url,headers=OPERATOR)
        self.assertEqual(detail.status_code,200,detail.text)
        self.assertEqual(detail.json()["case"]["qualification"],"unreviewed")

        review_url=detail_url+"/review"
        denied=self.client.patch(review_url,headers={**HEADERS,**OPERATOR},json={"stage":"matched"})
        self.assertEqual(denied.status_code,422,denied.text)
        qualified=self.client.patch(review_url,headers={**HEADERS,**OPERATOR},
          json={"qualification":"qualified","match_quality":"high",
                "candidate_role":"API integration engineer",
                "match_basis":"Applicant supplied a scoped API and code sample",
                "stage":"matched","owner":"founder_review",
                "next_action":"Offer a scoped pilot and get a reply"})
        self.assertEqual(qualified.status_code,200,qualified.text)
        self.assertFalse(qualified.json()["independently_verified"])
        no_source=self.client.patch(review_url,headers={**HEADERS,**OPERATOR},
            json={"stage":"executing"})
        self.assertEqual(no_source.status_code,422,no_source.text)
        assigned=self.client.patch(review_url,headers={**HEADERS,**OPERATOR},
          json={"stage":"executing","collaboration":"in_progress",
                "assignment_reference":"https://github.com/example/test/issues/16",
                "handoff_target":"workforce_os"})
        self.assertEqual(assigned.status_code,200,assigned.text)
        self.assertFalse(assigned.json()["independently_verified"])
        delivery=self.client.patch(review_url,headers={**HEADERS,**OPERATOR},
           json={"outcome":"shipped_work",
                 "outcome_evidence":"https://github.com/example/test/pull/17",
                 "verification_reference":"https://github.com/example/test/actions/runs/12"})
        self.assertEqual(delivery.status_code,200,delivery.text)
        self.assertEqual(delivery.json()["case"]["verification_state"],
                         "NOT_INDEPENDENTLY_VERIFIED")
        followed=self.client.post(f"/api/collaborate/cases/{case_id}/follow-up",
            headers=HEADERS,json={"tracking_token":token,"message":"My schedule changed.",
                                  "availability":"now"})
        self.assertEqual(followed.status_code,200,followed.text)
        self.assertFalse(followed.json()["assigned"])
        private=self.client.post(f"/api/collaborate/cases/{case_id}/follow-up",
            headers=HEADERS,json={"tracking_token":"x"*44,
                                  "message":"Unauthorized edit"})
        self.assertEqual(private.status_code,404)
        with database() as db:
            row=db.execute("SELECT availability FROM collaboration_applications WHERE case_id=%s",
                           (case_id,)).fetchone()
        self.assertEqual(row["availability"],"now")

    def test_notes_are_not_receipts(self):
        _,entry=self.submit()
        cid=entry["case"]["id"]
        endpoint=f"/api/collaborate/operator/people/{cid}/notes"
        saved=self.client.post(endpoint,headers={**HEADERS,**OPERATOR},
              json={"kind":"evidence","body":"Reviewed the candidate's public GitHub profile.",
                    "evidence_url":"https://github.com/example"})
        self.assertEqual(saved.status_code,200,saved.text)
        self.assertFalse(saved.json()["independently_verified"])
        detail=self.client.get(f"/api/collaborate/operator/people/{cid}",headers=OPERATOR)
        self.assertTrue(any(x["event_type"]=="evidence" for x in detail.json()["events"]))

if __name__=="__main__":
    unittest.main()
