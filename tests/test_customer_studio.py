"""Black-box public account, tenant separation, no-code and truthfulness tests."""
import os
import sys
import uuid
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ["ENVIRONMENT"]="development"
os.environ.pop("WORKFORCE_FABRIC_GATEWAY_KEY",None)
from app.main import app


def headers(csrf=""):
    return {"X-Workforce-Request":"workspace",
            "Content-Type":"application/json",
            **({"X-CSRF-Token":csrf} if csrf else {})}


class CustomerE2ETests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=TestClient(app)
        cls.root.__enter__()
    @classmethod
    def tearDownClass(cls):
        cls.root.__exit__(None,None,None)

    def signup(self):
        client=TestClient(app)
        email="customer_"+uuid.uuid4().hex[:12]+"@example.org"
        r=client.post("/api/register",json={
            "email":email,"password":"Correct Horse 8990",
            "workspace_name":"My Test Studio"},headers=headers())
        self.assertEqual(r.status_code,200,r.text)
        return client,r.json()

    def test_health_and_templates_never_invent_users(self):
        r=self.root.get("/health")
        self.assertEqual(r.status_code,200,r.text)
        self.assertTrue(r.json()["ok"])
        session=self.root.get("/api/session").json()
        self.assertFalse(session["authenticated"])
        self.assertEqual(len(self.root.get("/api/templates").json()["templates"]),4)

    def test_signup_private_workspace_and_real_team_creation(self):
        client,auth=self.signup()
        csrf=auth["csrf"]
        initial=client.get("/api/state").json()
        self.assertEqual(initial["teams"],[])
        self.assertEqual(initial["tickets"],[])
        self.assertEqual(initial["agents"],[])
        self.assertIn(initial["runtime"]["state"],("NOT_CONNECTED","RUNTIME_NOT_CONNECTED"))
        forbidden=client.post("/api/teams",json={
            "template":"growth","name":"Growth","mission":"Find five real customer interviews"},headers=headers())
        self.assertEqual(forbidden.status_code,403)
        created=client.post("/api/teams",json={
            "template":"growth","name":"Growth","mission":"Find five real customer interviews"},headers=headers(csrf))
        self.assertEqual(created.status_code,200,created.text)
        self.assertEqual(len(created.json()["agent_ids"]),3)
        state=client.get("/api/state").json()
        self.assertEqual(len(state["teams"]),1)
        self.assertEqual(len(state["agents"]),3)
        self.assertTrue(all(x["fabric_id"] is None for x in state["agents"]))
        self.assertTrue(all(x["sync_state"]=="NOT_CONNECTED" for x in state["agents"]))

    def test_ticket_retry_is_idempotent_and_does_not_fake_completion(self):
        client,auth=self.signup();csrf=auth["csrf"]
        team=client.post("/api/teams",json={"template":"builder","name":"Product Lab",
            "mission":"Build a small app for real customers"},headers=headers(csrf)).json()
        agent=team["agent_ids"][0]
        payload={"agent_id":agent,"title":"Write an initial product brief",
                 "instructions":"Prepare a specific brief with real acceptance criteria.",
                 "request_id":"browser_0123456789abcdef","run_now":True}
        one=client.post("/api/tickets",json=payload,headers=headers(csrf))
        two=client.post("/api/tickets",json=payload,headers=headers(csrf))
        self.assertEqual(one.status_code,200,one.text)
        self.assertEqual(two.status_code,200,two.text)
        self.assertEqual(one.json()["id"],two.json()["id"])
        state=client.get("/api/state").json()
        self.assertEqual(len(state["tickets"]),1)
        self.assertEqual(state["tickets"][0]["state"],"RUNTIME_NOT_CONNECTED")
        detail=client.get("/api/tickets/"+one.json()["id"]).json()
        self.assertEqual(detail["verification"],"NOT_INDEPENDENTLY_VERIFIED")
        self.assertIsNone(detail["runtime"])
        feedback=client.post("/api/tickets/"+one.json()["id"]+"/feedback",
            json={"feedback":"Make it more concrete with real evidence",
                  "request_id":"feedback_0123456789ab"},headers=headers(csrf))
        self.assertEqual(feedback.status_code,409)
        state=client.get("/api/state").json()
        self.assertEqual(state["notes"],[])

    def test_invalid_login_attempts_persist_after_failed_transactions(self):
        _,signed=self.signup()
        email=signed["account"]["email"]
        for n in range(7):
            denied=self.root.post("/api/login",json={
                "email":email,"password":"wrong-password"
            },headers=headers())
            self.assertEqual(denied.status_code,401,(n,denied.text))
        blocked=self.root.post("/api/login",json={
            "email":email,"password":"wrong-password"
        },headers=headers())
        self.assertEqual(blocked.status_code,429,blocked.text)

    def test_private_knowledge_and_task_context_selection(self):
        a,auth_a=self.signup()
        b,auth_b=self.signup()
        csrf=auth_a["csrf"]
        saved=a.post("/api/knowledge",json={"title":"Our product facts",
            "content":"Customer-provided factual context about our target users and product scope."},
            headers=headers(csrf))
        self.assertEqual(saved.status_code,200,saved.text)
        document_id=saved.json()["id"]
        self.assertEqual(len(a.get("/api/state").json()["knowledge"]),1)
        self.assertEqual(b.get("/api/state").json()["knowledge"],[])
        self.assertEqual(b.get("/api/knowledge/"+document_id).status_code,404)
        self.assertEqual(b.delete("/api/knowledge/"+document_id,headers=headers(auth_b["csrf"])).status_code,404)
        team=a.post("/api/teams",json={"template":"builder","name":"Product Lab",
            "mission":"Create a practical app from actual user requirements"},
            headers=headers(csrf)).json()
        agent=team["agent_ids"][0]
        payload={"agent_id":agent,"title":"Create a product specification",
            "instructions":"Write a specification grounded in the selected references.",
            "request_id":"knowledge_0123456789abcd","run_now":False,
            "knowledge_ids":[document_id]}
        created=a.post("/api/tickets",json=payload,headers=headers(csrf))
        self.assertEqual(created.status_code,200,created.text)
        task_id=created.json()["id"]
        detail=a.get("/api/tickets/"+task_id).json()
        self.assertEqual(detail["knowledge"][0]["id"],document_id)
        duplicate=a.post("/api/tickets",json={**payload,"knowledge_ids":[]},
                         headers=headers(csrf))
        self.assertEqual(duplicate.status_code,409)
        self.assertEqual(b.get("/api/tickets/"+task_id).status_code,404)
        deleted=a.delete("/api/knowledge/"+document_id,headers=headers(csrf))
        self.assertEqual(deleted.status_code,200,deleted.text)
        self.assertEqual(a.get("/api/state").json()["knowledge"],[])

    def test_reject_foreign_knowledge_and_missing_csrf(self):
        a,auth_a=self.signup()
        b,auth_b=self.signup()
        document=b.post("/api/knowledge",json={"title":"Private competitor document",
            "content":"This is an unrelated tenant secret and must not be exposed."},
            headers=headers(auth_b["csrf"])).json()["id"]
        self.assertEqual(a.get("/api/knowledge/"+document).status_code,404)
        self.assertEqual(a.post("/api/knowledge",json={"title":"Untrusted",
            "content":"A new document without any authorization header."},
            headers=headers()).status_code,403)
        team=a.post("/api/teams",json={"template":"builder","name":"Research",
            "mission":"Prepare a plan using owned data only"},headers=headers(auth_a["csrf"])).json()
        payload={"agent_id":team["agent_ids"][0],"title":"Analyze source",
            "instructions":"Read only my approved workspace sources.",
            "request_id":"foreign_0123456789abcdef","knowledge_ids":[document]}
        denied=a.post("/api/tickets",json=payload,headers=headers(auth_a["csrf"]))
        self.assertEqual(denied.status_code,404,denied.text)
        self.assertEqual(a.get("/api/state").json()["tickets"],[])

    def test_subscription_state_never_invented_and_checkout_is_disabled_without_keys(self):
        client,auth=self.signup()
        state=client.get("/api/state").json()
        self.assertEqual(state["billing"]["plan"],"free")
        self.assertFalse(state["billing"]["active"])
        self.assertEqual(state["limits"]["teams"],1)
        plans=client.get("/api/billing/plans")
        self.assertEqual(plans.status_code,200)
        self.assertFalse(plans.json()["checkout_ready"])
        checkout=client.post("/api/billing/checkout",json={"plan":"builder"},
                             headers=headers(auth["csrf"]))
        self.assertEqual(checkout.status_code,503,checkout.text)
        self.assertEqual(client.get("/api/billing/status").json()["plan"],"free")
        portal=client.post("/api/billing/portal",json={},headers=headers(auth["csrf"]))
        # TestClient uses testserver; the billing redirect must reject hosts
        # that are not the explicitly configured public origin.
        self.assertEqual(portal.status_code,403,portal.text)
        self.assertEqual(client.post("/api/billing/webhook",json={"type":"customer.subscription.created"},
                                     headers={"Stripe-Signature":"t=0,v1=invalid"}).status_code,400)

    def test_real_free_tier_capacity_is_enforced(self):
        client,auth=self.signup()
        csrf=auth["csrf"]
        first=client.post("/api/teams",json={"template":"growth","name":"First team",
            "mission":"Test real customer demand and provide concrete next steps"},headers=headers(csrf))
        self.assertEqual(first.status_code,200,first.text)
        second=client.post("/api/teams",json={"template":"support","name":"Second team",
            "mission":"Support real customer enquiries and track response quality"},headers=headers(csrf))
        self.assertEqual(second.status_code,409,second.text)
        self.assertEqual(second.json()["detail"],"TEAM_LIMIT_REACHED")
        self.assertEqual(len(client.get("/api/state").json()["teams"]),1)

    def test_workspace_isolation(self):
        a,auth_a=self.signup()
        b,auth_b=self.signup()
        team=a.post("/api/teams",json={"template":"support","name":"Help Desk",
              "mission":"Respond to real support enquiries"},headers=headers(auth_a["csrf"]))
        self.assertEqual(team.status_code,200)
        agent_id=team.json()["agent_ids"][0]
        other=b.get("/api/state").json()
        self.assertEqual(other["teams"],[])
        forbidden=b.patch("/api/agents/"+agent_id,json={
            "instructions":"Try to take over someone else's agent"},
            headers=headers(auth_b["csrf"]))
        self.assertEqual(forbidden.status_code,404)
        a_state=a.get("/api/state").json()
        self.assertEqual(len(a_state["teams"]),1)


if __name__=="__main__":
    unittest.main()
