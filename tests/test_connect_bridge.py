"""Canonical Noetfield Connect bridge: database-backed, replay-safe acceptance."""
import os
import unittest
import uuid
from fastapi.testclient import TestClient

os.environ["ENVIRONMENT"] = "development"
os.environ.setdefault("WORKFORCE_CONNECT_BRIDGE_KEY", "ci-bridge-secret-" + "A" * 48)
os.environ.setdefault("OPPORTUNITY_OPERATOR_KEY", "ci-operator-secret-" + "B" * 48)

from app.main import app
from app.storage import database

HEADERS = {"Content-Type": "application/json",
           "X-Workforce-Request": "workspace"}


class CanonicalBridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)

    def body(self):
        rid = uuid.uuid4().hex[:16].upper()
        return {
            "source_intake_id": "INT-" + rid,
            "source_request_id": "RID-CNX-" + rid,
            "vector": "external-opportunities",
            "contact_name": "CI Verified Candidate",
            "contact_email": "candidate-bridge@example.org",
            "organization": "Independent professional",
            "message": "I can deliver a real testable code integration for a scoped engineering project.",
            "metadata": {
                "category": "people", "consent_contact": True,
                "participant_role": "human_contributor",
                "lead_source": "linkedin", "skills": "Python, AI systems and testing",
                "availability": "now", "work_model": "project",
                "initiative": "workforce",
                "portfolio_url": "https://github.com/example/profile",
                "conversation_context": "LinkedIn discussion about a scoped code review",
            }
        }

    def auth(self):
        return {**HEADERS, "X-Noetfield-Bridge-Key":
                os.environ["WORKFORCE_CONNECT_BRIDGE_KEY"]}

    def test_guard_consent_deduplication_and_readback(self):
        b = self.body()
        endpoint = "/api/integrations/noetfield-connect"
        self.assertEqual(self.client.post(endpoint, json=b, headers=HEADERS).status_code, 403)
        self.assertEqual(self.client.post(endpoint, json=b,
            headers={**HEADERS, "X-Noetfield-Bridge-Key": "wrong"}).status_code, 403)
        first = self.client.post(endpoint, json=b, headers=self.auth())
        self.assertEqual(first.status_code, 200, first.text)
        self.assertTrue(first.json()["accepted"])
        self.assertFalse(first.json()["deduped"])
        cid = first.json()["case_id"]
        self.assertEqual(first.json()["source_intake_id"], b["source_intake_id"])
        self.assertFalse(first.json()["assigned"])
        self.assertFalse(first.json()["independently_verified"])
        second = self.client.post(endpoint, json=b, headers=self.auth())
        self.assertEqual(second.status_code, 200, second.text)
        self.assertTrue(second.json()["deduped"])
        self.assertEqual(second.json()["case_id"], cid)
        with database() as db:
            cases = db.execute("""SELECT id, source_intake_id, source_request_id, stage,
                          status, verification_state, next_action
                          FROM opportunity_cases WHERE source_intake_id=%s""",
                          (b["source_intake_id"],)).fetchall()
            applicants = db.execute("SELECT skills, availability FROM collaboration_applications WHERE case_id=%s",
                                   (cid,)).fetchall()
            events = db.execute("SELECT event_type FROM opportunity_events WHERE case_id=%s",
                                (cid,)).fetchall()
        self.assertEqual(len(cases), 1)
        self.assertEqual(len(applicants), 1)
        self.assertEqual(len(events), 1)
        self.assertEqual(cases[0]["stage"], "received")
        self.assertEqual(cases[0]["source_request_id"], b["source_request_id"])
        self.assertEqual(cases[0]["verification_state"], "NOT_INDEPENDENTLY_VERIFIED")
        operator = {"X-Opportunity-Operator-Key": os.environ["OPPORTUNITY_OPERATOR_KEY"]}
        readback = self.client.get("/api/collaborate/operator/people?q=" +
                                   b["source_intake_id"], headers=operator)
        self.assertEqual(readback.status_code, 200, readback.text)
        self.assertTrue(any(x["case_id"] == cid and
                            x["source_intake_id"] == b["source_intake_id"]
                            for x in readback.json()["cases"]))

    def test_no_canonical_contact_or_other_venture_leak(self):
        url = "/api/integrations/noetfield-connect"
        b = self.body()
        b["metadata"]["category"] = "business"
        self.assertEqual(self.client.post(url, json=b, headers=self.auth()).status_code, 422)
        b["metadata"]["category"] = "people"
        b["metadata"]["consent_contact"] = False
        self.assertEqual(self.client.post(url, json=b, headers=self.auth()).status_code, 422)
        b["vector"] = "contact"
        b["metadata"]["consent_contact"] = True
        self.assertEqual(self.client.post(url, json=b, headers=self.auth()).status_code, 422)

    def test_contributor_intake_retains_canonical_reference(self):
        b = self.body()
        b["vector"] = "work-with-us-contributor"
        b["metadata"] = {
            "application_kind": "agent", "project_id": "noetfield",
            "role": "qa", "evidence_url": "https://github.com/example/agent",
            "consent_contact": True,
        }
        res = self.client.post("/api/integrations/noetfield-connect",
                               json=b, headers=self.auth())
        self.assertEqual(res.status_code, 200, res.text)
        with database() as db:
            row = db.execute("""SELECT c.participant,c.kind,a.lane,a.focus
                       FROM opportunity_cases c JOIN collaboration_applications a
                       ON c.id=a.case_id WHERE c.source_intake_id=%s""",
                       (b["source_intake_id"],)).fetchone()
        self.assertEqual((row["participant"], row["kind"], row["lane"], row["focus"]),
                         ("ai", "agent_work", "agent_owner", "engineering"))


if __name__ == "__main__":
    unittest.main()
