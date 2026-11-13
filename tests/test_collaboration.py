"""End-to-end collaboration gateway: real stored opportunity, privacy, feedback and attribution."""
import os
import unittest
import uuid

from fastapi.testclient import TestClient

os.environ["ENVIRONMENT"] = "development"
os.environ.setdefault("OPPORTUNITY_OPERATOR_KEY", "test-opportunity-operator-key-" + "a" * 40)
from app.main import app
from app.storage import database

HEADERS = {"X-Workforce-Request": "workspace", "Content-Type": "application/json"}
OPERATOR = {"X-Opportunity-Operator-Key": os.environ["OPPORTUNITY_OPERATOR_KEY"]}


class CollaborationGatewayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def application(self, **changes):
        n = uuid.uuid4().hex
        form = {
            "full_name": "QA Collaborator",
            "email": "collab_" + n[:15] + "@example.org",
            "lane": "freelancer",
            "focus": "engineering",
            "skills": "Python, TypeScript, PostgreSQL, real CI",
            "availability": "project",
            "proposal": "Build a small real API integration, add tests and deliver a reviewable pull request.",
            "linkedin_url": "https://www.linkedin.com/in/qa-collaborator/",
            "portfolio_url": "https://github.com/example",
            "venture": "WorkforceOS",
            "source": "linkedin",
            "campaign": "november2026",
            "referral_code": "founder-" + n[:8],
            "session_id": str(uuid.uuid4()),
            "analytics_consent": False,
            "contact_consent": True,
        }
        form.update(changes)
        return form

    def test_public_page_and_private_operator(self):
        res = self.client.get("/join?source=linkedin&ref=abc")
        self.assertEqual(res.status_code, 200, res.text)
        self.assertIn("The collaboration gateway", res.text.lower())
        self.assertIn('name="contact_consent"', res.text)
        self.assertIn("فارسی", res.text)
        self.assertEqual(self.client.get("/collaborate").status_code, 200)
        self.assertEqual(self.client.get("/work-with-us").status_code, 200)
        self.assertEqual(self.client.get("/static/collaborate.js").status_code, 200)
        self.assertEqual(self.client.get("/static/collaborate.css").status_code, 200)
        self.assertEqual(self.client.get("/api/collaborate/operator/overview").status_code, 403)

    def test_opt_in_events_and_attribution(self):
        sid = str(uuid.uuid4())
        body = {"session_id": sid, "event_name": "page_view", "source": "linkedin",
                "lane": "freelancer", "referral_code": "test-ref", "campaign": "november2026",
                "analytics_consent": False}
        denied = self.client.post("/api/collaborate/events", headers=HEADERS, json=body)
        self.assertEqual(denied.status_code, 200)
        self.assertFalse(denied.json()["recorded"])
        saved = self.client.post("/api/collaborate/events", headers=HEADERS,
                                 json={**body, "analytics_consent": True})
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertTrue(saved.json()["recorded"])
        with database() as db:
            row = db.execute("""SELECT source,campaign,referral_code FROM collaboration_events
                                WHERE session_id=%s""", (sid,)).fetchone()
        self.assertEqual(row["source"], "linkedin")
        self.assertEqual(row["referral_code"], "test-ref")
        invalid = self.client.post("/api/collaborate/events", headers=HEADERS,
                                   json={**body, "analytics_consent": True, "session_id": "short"})
        self.assertEqual(invalid.status_code, 422)

    def test_real_case_tracking_feedback_and_operator(self):
        form = self.application()
        response = self.client.post("/api/collaborate/apply", json=form, headers=HEADERS)
        self.assertEqual(response.status_code, 201, response.text)
        created = response.json()
        self.assertTrue(created["received"])
        case_id, token = created["case"]["id"], created["tracking_token"]
        self.assertEqual(created["case"]["owner"], "intake_queue")
        self.assertEqual(created["case"]["status"], "new")
        self.assertEqual(created["case"]["recommended_lane"], "WorkforceOS / Human collaboration")
        with database() as db:
            saved = db.execute("""SELECT a.*,c.kind,c.next_action,c.email,c.source
                                  FROM collaboration_applications a
                                  JOIN opportunity_cases c ON c.id=a.case_id WHERE a.case_id=%s""",
                               (case_id,)).fetchone()
        self.assertEqual(saved["skills"], form["skills"])
        self.assertEqual(saved["kind"], "recruiting")
        self.assertEqual(saved["referral_code"], form["referral_code"])
        self.assertEqual(saved["source"], "linkedin")
        self.assertIn("Review skills", saved["next_action"])
        missing = self.client.get("/api/collaborate/cases/" + case_id + "/track")
        self.assertEqual(missing.status_code, 404)
        tracked = self.client.get("/api/collaborate/cases/" + case_id + "/track",
                                  headers={"X-Opportunity-Tracking-Token": token})
        self.assertEqual(tracked.status_code, 200)
        self.assertNotIn("email", tracked.json()["case"])
        bad = self.client.post("/api/collaborate/cases/" + case_id + "/feedback",
                               headers=HEADERS,json={"tracking_token": "x" * 50,
                                                    "rating": 5,"message": "Great form."})
        self.assertEqual(bad.status_code, 404)
        ok = self.client.post("/api/collaborate/cases/" + case_id + "/feedback",
                              headers=HEADERS,json={"tracking_token": token,
                                                   "rating": 4,"message": "It was clear."})
        self.assertEqual(ok.status_code, 200, ok.text)
        operator = self.client.get("/api/collaborate/operator/overview",headers=OPERATOR)
        self.assertEqual(operator.status_code, 200, operator.text)
        self.assertEqual(operator.json()["measurement"], "REAL_DATABASE_RECORDS")
        self.assertTrue(any(x["case_id"]==case_id
                            for x in operator.json()["recent_applications"]))
        self.assertGreaterEqual(operator.json()["feedback_count"], 1)

    def test_validation_avoids_fake_submissions(self):
        no_consent = self.client.post("/api/collaborate/apply",
                                      json=self.application(contact_consent=False),headers=HEADERS)
        self.assertEqual(no_consent.status_code, 422)
        bad_url = self.client.post("/api/collaborate/apply",
                                   json=self.application(portfolio_url="http://insecure.example"),headers=HEADERS)
        self.assertEqual(bad_url.status_code, 422)
        bad_route = self.client.post("/api/collaborate/apply",
                                     json=self.application(lane="made_up"),headers=HEADERS)
        self.assertEqual(bad_route.status_code, 422)
        blocked = self.client.post("/api/collaborate/apply",
                                   json=self.application(website="spam.example"),headers=HEADERS)
        self.assertEqual(blocked.status_code, 201)
        self.assertNotIn("case", blocked.json())


if __name__ == "__main__":
    unittest.main()
