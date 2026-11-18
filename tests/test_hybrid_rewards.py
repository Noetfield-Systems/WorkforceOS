"""WorkforceOS hybrid business and first-party participation acceptance.

No synthetic payouts, currency conversions, token claims or real user transactions.
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
os.environ.pop("WORKFORCE_FABRIC_GATEWAY_KEY",None)
from app.main import app
from app.agent_dna import Profile, compile_instructions, preset_profile
from app.storage import database


def headers(csrf=None):
    result={"Content-Type":"application/json","X-Workforce-Request":"workspace"}
    if csrf:result["X-CSRF-Token"]=csrf
    return result

class HybridRewardsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=TestClient(app);cls.root.__enter__()
    @classmethod
    def tearDownClass(cls):
        cls.root.__exit__(None,None,None)

    def signup(self,referral=None):
        c=TestClient(app)
        payload={"email":"xp_"+uuid.uuid4().hex[:16]+"@example.org",
                 "password":"Correct-Horse-123456","workspace_name":"XP QA"}
        if referral is not None:payload["referral_code"]=referral
        r=c.post("/api/register",headers=headers(),json=payload)
        self.assertEqual(r.status_code,200,r.text)
        return c,r.json()["csrf"]

    def test_hybrid_capabilities_are_truthful_and_no_token_claims(self):
        info=self.root.get("/api/hybrid/status")
        self.assertEqual(info.status_code,200,info.text)
        data=info.json()
        self.assertEqual(data["venture"],"WorkforceOS")
        self.assertEqual(data["product_mode"],"hybrid_ai_workforce")
        self.assertFalse(data["corporate_token_issued"])
        self.assertFalse(data["token_sale_active"])
        self.assertFalse(data["crypto_checkout_active"])
        self.assertFalse(data["paid_agent_listings_active"])
        self.assertFalse(data["creator_payouts_active"])
        rails={x["id"]:x for x in data["payment_rails"]}
        self.assertFalse(rails["crypto"]["enabled"])
        self.assertIn("stripe",rails)
        self.assertTrue(data["participation"]["internal_only"])
        self.assertFalse(data["participation"]["cash_value"])
        self.assertFalse(data["participation"]["token_claim"])
        self.assertFalse(data["participation"]["payment_credit"])
        for path,asset in (("/commerce","/static/commerce.js"),
                           ("/rewards","/static/rewards.js")):
            r=self.root.get(path)
            self.assertEqual(r.status_code,200,r.text)
            self.assertIn(asset,r.text)
        for path in ("/static/commerce.css","/static/commerce.js",
                     "/static/rewards.css","/static/rewards.js",
                     "/static/agent-studio-v7.css"):
            self.assertEqual(self.root.get(path).status_code,200,path)

    def test_advanced_dna_persists_and_compiles_real_instruction_policy(self):
        p=preset_profile("research_analyst")
        p["ethics"]={"evidence":"explicit_uncertainty","privacy":"approved_sources",
                     "escalation":"human_review","sensitive_actions":"never"}
        p["output"]={"format":"json_outline","detail":"comprehensive",
                      "review":"independent_review_requested",
                      "citation_mode":"strict_source_ids"}
        p["model_provider_request"]="deepseek"
        instructions=compile_instructions(p)
        self.assertIn("ETHICS / EVIDENCE CONTRACT",instructions)
        self.assertIn("Only sources expressly selected",instructions) if False else None
        self.assertIn("only sources expressly selected",instructions.lower())
        self.assertIn("human review",instructions.lower())
        self.assertIn("independent verification",instructions.lower())
        self.assertIn("json-style",instructions.lower())
        self.assertNotIn("deepseek",instructions.lower())
        invalid={**p,"ethics":{**p["ethics"],"privacy":"upload_all_documents"}}
        with self.assertRaises(Exception):Profile.model_validate(invalid)
        catalog=self.root.get("/api/agent-dna/catalog").json()
        self.assertTrue(catalog["capabilities"]["ethics_instruction_sync"])
        self.assertFalse(catalog["capabilities"]["runtime_model_choice"])
        self.assertIn("deepseek",catalog["model_provider_requests"])
        client,csrf=self.signup()
        created=client.post("/api/agent-dna",headers=headers(csrf),
                            json={"preset_id":"research_analyst"})
        self.assertEqual(created.status_code,200,created.text)
        agent_id=created.json()["agent_id"]
        saved=client.put("/api/agent-dna/"+agent_id,headers=headers(csrf),
                         json={"expected_revision":1,"profile":p})
        self.assertEqual(saved.status_code,200,saved.text)
        self.assertEqual(client.get("/api/agent-dna/"+agent_id).json()["profile"]["ethics"]["privacy"],
                         "approved_sources")
        with database() as db:
            record=db.execute("SELECT instructions FROM agents WHERE id=%s",(agent_id,)).fetchone()
        self.assertIn("DATA HANDLING",record["instructions"])
        self.assertNotIn("deepseek",record["instructions"].lower())

    def test_daily_first_agent_and_quiz_are_idempotent_and_tenant_isolated(self):
        program=self.root.get("/api/rewards/program").json()
        self.assertTrue(program["non_transferable"])
        self.assertFalse(program["token_or_airdrop_entitlement"])
        self.assertFalse(program["redeemable_for_paid_runtime"])
        a,csrf_a=self.signup()
        b,csrf_b=self.signup()
        self.assertEqual(self.root.get("/api/rewards/me").status_code,401)
        self.assertEqual(a.post("/api/rewards/daily",json={},headers=headers()).status_code,403)
        self.assertEqual(a.get("/api/rewards/me").json()["balance"],0)
        daily=a.post("/api/rewards/daily",json={},headers=headers(csrf_a))
        self.assertEqual(daily.status_code,200,daily.text)
        self.assertEqual(daily.json()["points"],5)
        dup=a.post("/api/rewards/daily",json={},headers=headers(csrf_a))
        self.assertEqual(dup.status_code,200,dup.text)
        self.assertEqual(dup.json()["points"],0)
        self.assertFalse(dup.json()["awarded"])
        bad=a.post("/api/rewards/quiz",headers=headers(csrf_a),json={
            "quiz_id":"agent-dna-basics-v1","answer_id":"a"})
        self.assertFalse(bad.json()["correct"])
        good=a.post("/api/rewards/quiz",headers=headers(csrf_a),json={
            "quiz_id":"agent-dna-basics-v1","answer_id":"b"})
        self.assertTrue(good.json()["awarded"])
        dupquiz=a.post("/api/rewards/quiz",headers=headers(csrf_a),json={
            "quiz_id":"agent-dna-basics-v1","answer_id":"b"})
        self.assertFalse(dupquiz.json()["awarded"])
        create=a.post("/api/agent-dna",headers=headers(csrf_a),
                      json={"preset_id":"sales_operator"})
        self.assertEqual(create.status_code,200,create.text)
        first=a.get("/api/rewards/me").json()
        self.assertEqual(first["balance"],40)
        self.assertTrue(first["first_agent_claimed"])
        self.assertTrue(first["quiz_claimed"])
        self.assertTrue(first["today_claimed"])
        self.assertEqual(b.get("/api/rewards/me").json()["balance"],0)
        other=b.post("/api/rewards/daily",json={},headers=headers(csrf_b))
        self.assertEqual(other.json()["points"],5)
        self.assertEqual(b.get("/api/rewards/me").json()["balance"],5)

    def test_referral_requires_new_registration_and_first_real_agent_not_link_click(self):
        inviter,inviter_csrf=self.signup()
        initial=inviter.get("/api/rewards/referrals")
        self.assertEqual(initial.status_code,200,initial.text)
        self.assertIsNone(initial.json()["invite_url"])
        self.assertEqual(initial.json()["registrations"],0)
        self.assertEqual(inviter.post("/api/rewards/invite",headers=headers(),json={}).status_code,403)
        code_response=inviter.post("/api/rewards/invite",headers=headers(inviter_csrf),json={})
        self.assertEqual(code_response.status_code,200,code_response.text)
        code=code_response.json()["code"]
        self.assertTrue(code_response.json()["url"].endswith("/app?ref="+code))
        duplicate=inviter.post("/api/rewards/invite",headers=headers(inviter_csrf),json={})
        self.assertEqual(duplicate.json()["code"],code)
        self.assertEqual(inviter.get("/api/rewards/me").json()["balance"],0)

        newcomer,member_csrf=self.signup(referral=code)
        tracked=inviter.get("/api/rewards/referrals").json()
        self.assertEqual(tracked["registrations"],1)
        self.assertEqual(tracked["activated_workspaces"],0)
        self.assertEqual(tracked["rewarded_referrals"],0)
        self.assertTrue(newcomer.get("/api/rewards/referrals").json()["my_pending_invite"])
        self.assertEqual(newcomer.get("/api/rewards/me").json()["balance"],0)
        self.assertEqual(inviter.get("/api/rewards/me").json()["balance"],0)

        first=newcomer.post("/api/agent-dna",headers=headers(member_csrf),
                            json={"preset_id":"product_engineer"})
        self.assertEqual(first.status_code,200,first.text)
        self.assertEqual(newcomer.get("/api/rewards/me").json()["balance"],30)
        self.assertEqual(inviter.get("/api/rewards/me").json()["balance"],25)
        referral=inviter.get("/api/rewards/referrals").json()
        self.assertEqual(referral["registrations"],1)
        self.assertEqual(referral["activated_workspaces"],1)
        self.assertEqual(referral["rewarded_referrals"],1)
        self.assertFalse(newcomer.get("/api/rewards/referrals").json()["my_pending_invite"])
        self.assertEqual(newcomer.post("/api/agent-dna",
            headers=headers(member_csrf),json={"preset_id":"research_analyst"}).status_code,200)
        self.assertEqual(newcomer.get("/api/rewards/me").json()["balance"],30)
        self.assertEqual(inviter.get("/api/rewards/me").json()["balance"],25)

        invalid,invalid_csrf=self.signup(referral="nobody_has_this_code")
        self.assertEqual(invalid.post("/api/agent-dna",headers=headers(invalid_csrf),
                                     json={"preset_id":"research_analyst"}).status_code,200)
        self.assertEqual(invalid.get("/api/rewards/me").json()["balance"],20)
        self.assertEqual(inviter.get("/api/rewards/me").json()["balance"],25)
        self.assertEqual(invalid.get("/api/rewards/referrals").json()["registrations"],0)
        self.assertIsNone(invalid.get("/api/rewards/referrals").json()["invite_code"])

        pending,pending_csrf=self.signup(referral=code)
        self.assertEqual(inviter.get("/api/rewards/referrals").json()["registrations"],2)
        self.assertEqual(inviter.get("/api/rewards/referrals").json()["activated_workspaces"],1)
        self.assertEqual(inviter.get("/api/rewards/me").json()["balance"],25)
        self.assertTrue(pending.get("/api/rewards/referrals").json()["my_pending_invite"])

    def test_feedback_reward_is_attributed_once_per_week(self):
        client,csrf=self.signup()
        feedback="I need agent test results to display source IDs and decision criteria clearly."
        for idx in range(2):
            r=client.post("/api/product-feedback",headers=headers(csrf),
                          json={"feedback":feedback+str(idx)})
            self.assertEqual(r.status_code,200,r.text)
        state=client.get("/api/rewards/me").json()
        self.assertTrue(state["feedback_week_claimed"])
        self.assertEqual(state["balance"],10)
        self.assertEqual(len([x for x in state["history"] if x["kind"]=="product_feedback"]),1)
        short=client.post("/api/product-feedback",headers=headers(csrf),
                          json={"feedback":"short note"})
        self.assertEqual(short.status_code,200)
        self.assertEqual(client.get("/api/rewards/me").json()["balance"],10)

if __name__=="__main__":
    unittest.main()
