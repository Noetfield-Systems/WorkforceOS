"""End-to-end Agent DNA Studio tests against the existing PostgreSQL and ticket runtime."""
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
from app.agent_dna import compile_instructions, preset_profile, Profile


def headers(csrf=None):
    r={"Content-Type":"application/json","X-Workforce-Request":"workspace"}
    if csrf:r["X-CSRF-Token"]=csrf
    return r


class AgentDNATests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root=TestClient(app)
        cls.root.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.root.__exit__(None,None,None)

    def signup(self):
        c=TestClient(app)
        r=c.post("/api/register",json={
            "email":"agent_dna_"+uuid.uuid4().hex[:16]+"@example.org",
            "password":"Correct-Horse-123456",
            "workspace_name":"Agent DNA QA",
        },headers=headers())
        self.assertEqual(r.status_code,200,r.text)
        return c,r.json()["csrf"]

    def test_public_catalog_and_preset_compiler(self):
        r=self.root.get("/agent-studio")
        self.assertEqual(r.status_code,200,r.text)
        self.assertIn("Agent DNA Studio",r.text)
        catalog=self.root.get("/api/agent-dna/catalog")
        self.assertEqual(catalog.status_code,200,catalog.text)
        self.assertEqual(len(catalog.json()["presets"]),33)
        self.assertFalse(catalog.json()["capabilities"]["custom_tool_grants"])
        self.assertFalse(catalog.json()["capabilities"]["marketplace_checkout"])
        p=preset_profile("research_analyst")
        self.assertIn("Mission".upper(),compile_instructions(p))
        self.assertIn("SKILLS AND DELIVERABLE STANDARDS",compile_instructions(p))
        p["requested_tools"]=["github","email"]
        self.assertNotIn("github",compile_instructions(p).lower())
        with self.assertRaises(Exception):
            Profile.model_validate({**p,"skills":["unknown"]})

    def test_real_create_versioned_save_and_run(self):
        client,csrf=self.signup()
        self.assertEqual(client.post("/api/agent-dna",json={"preset_id":"sales_operator"},
                                     headers=headers()).status_code,403)
        initial=client.post("/api/agent-dna",json={"preset_id":"sales_operator"},
                            headers=headers(csrf))
        self.assertEqual(initial.status_code,200,initial.text)
        aid=initial.json()["agent_id"]
        self.assertEqual(initial.json()["revision"],1)
        self.assertEqual(initial.json()["sync_state"],"NOT_CONNECTED")
        detail=client.get("/api/agent-dna/"+aid).json()
        self.assertEqual(detail["profile"]["name"],"Nova")
        self.assertEqual(detail["revision"],1)
        profile=detail["profile"]
        profile["name"]="Nova Prime"
        profile["traits"]["critical_thinking"]=95
        profile["skills"]=["sales","research","critical_review"]
        profile["requested_tools"]=["github"]
        doc=client.post("/api/knowledge",json={"title":"Private QA Source",
            "content":"A test-only company policy that is private to the QA tenant."},
            headers=headers(csrf))
        self.assertEqual(doc.status_code,200,doc.text)
        knowledge_id=doc.json()["id"]
        profile["knowledge_ids"]=[knowledge_id]
        saved=client.put("/api/agent-dna/"+aid,json={"expected_revision":1,"profile":profile},
                         headers=headers(csrf))
        self.assertEqual(saved.status_code,200,saved.text)
        self.assertEqual(saved.json()["revision"],2)
        self.assertEqual(client.put("/api/agent-dna/"+aid,
                          json={"expected_revision":1,"profile":profile},
                          headers=headers(csrf)).status_code,409)
        state=client.get("/api/state").json()
        changed=next(a for a in state["agents"] if a["id"]==aid)
        self.assertEqual(changed["name"],"Nova Prime")
        self.assertIn("95/100",changed["instructions"])
        self.assertNotIn("github",changed["instructions"].lower())
        versions=client.get("/api/agent-dna/"+aid+"/revisions")
        self.assertEqual(versions.status_code,200,versions.text)
        self.assertEqual([x["revision"] for x in versions.json()["revisions"]],[2,1])
        readiness=client.get("/api/agent-dna/"+aid+"/readiness").json()
        self.assertEqual(readiness["evaluation"],"CONFIG_READINESS_ONLY")
        self.assertFalse(readiness["model_behavior_tested"])
        run=client.post("/api/agent-dna/"+aid+"/run",json={
            "title":"Research the real buyer problem",
            "instructions":"Study the supplied reference and produce an evidence-based outline.",
            "request_id":"dna_"+uuid.uuid4().hex,"run_now":True},
            headers=headers(csrf))
        self.assertEqual(run.status_code,200,run.text)
        self.assertEqual(run.json()["state"],"RUNTIME_NOT_CONNECTED")
        task=client.get("/api/tickets/"+run.json()["id"]).json()
        self.assertEqual(task["verification"],"NOT_INDEPENDENTLY_VERIFIED")
        self.assertEqual(task["knowledge"][0]["id"],knowledge_id)
        published=client.post("/api/agent-dna/"+aid+"/publish",
            json={"public":True},headers=headers(csrf))
        self.assertEqual(published.status_code,200,published.text)
        public_items=client.get("/api/agent-dna/gallery").json()["community_templates"]
        entry=next(x for x in public_items if x["id"]==aid)
        self.assertEqual(entry["profile"]["knowledge_ids"],[])
        self.assertEqual(entry["profile"]["requested_tools"],[])
        other,other_csrf=self.signup()
        self.assertEqual(other.get("/api/agent-dna/"+aid).status_code,404)
        self.assertEqual(other.get("/api/agent-dna/"+aid+"/revisions").status_code,404)
        self.assertEqual(other.post("/api/agent-dna/"+aid+"/publish",
                         json={"public":False},headers=headers(other_csrf)).status_code,404)
        cloned=other.post("/api/agent-dna/gallery/"+aid+"/clone",json={},
                          headers=headers(other_csrf))
        self.assertEqual(cloned.status_code,200,cloned.text)
        new_id=cloned.json()["agent_id"]
        copied=other.get("/api/agent-dna/"+new_id).json()["profile"]
        self.assertEqual(copied["name"],"Nova Prime")
        self.assertEqual(copied["knowledge_ids"],[])
        self.assertEqual(copied["requested_tools"],[])
        self.assertNotEqual(new_id,aid)
        disabled=client.post("/api/agent-dna/"+aid+"/publish",
                        json={"public":False},headers=headers(csrf))
        self.assertEqual(disabled.status_code,200,disabled.text)
        self.assertFalse(any(x["id"]==aid for x in
            other.get("/api/agent-dna/gallery").json()["community_templates"]))

    def test_agent_arena_is_source_backed_and_never_fakes_evals(self):
        c,csrf=self.signup()
        a=c.post("/api/agent-dna",json={"preset_id":"sales_operator"},headers=headers(csrf))
        b=c.post("/api/agent-dna",json={"preset_id":"research_analyst"},headers=headers(csrf))
        self.assertEqual(a.status_code,200,a.text)
        self.assertEqual(b.status_code,200,b.text)
        aid=a.json()["agent_id"];bid=b.json()["agent_id"]
        rid="arena_"+uuid.uuid4().hex
        payload={"agent_a_id":aid,"agent_b_id":bid,"title":"Analyze an early business offer",
            "instructions":"Propose one measurable acquisition experiment grounded in the provided facts.",
            "request_id":rid,"run_now":True}
        same=c.post("/api/agent-arena",json={**payload,"agent_b_id":aid},
                    headers=headers(csrf))
        self.assertEqual(same.status_code,400,same.text)
        created=c.post("/api/agent-arena",json=payload,headers=headers(csrf))
        self.assertEqual(created.status_code,200,created.text)
        item=created.json()
        self.assertEqual(item["comparison_state"],"WAITING_FOR_REAL_OUTPUTS")
        self.assertIsNone(item["automated_score"])
        self.assertFalse(item["a"]["output_ready"])
        self.assertFalse(item["b"]["output_ready"])
        self.assertNotEqual(item["a"]["ticket_id"],item["b"]["ticket_id"])
        self.assertEqual(item["a"]["state"],"RUNTIME_NOT_CONNECTED")
        self.assertEqual(item["b"]["state"],"RUNTIME_NOT_CONNECTED")
        self.assertEqual(c.post("/api/agent-arena/"+item["id"]+"/review",
              json={"winner":"a","notes":"Prefer the more concrete proposal."},
              headers=headers(csrf)).status_code,409)
        duplicate=c.post("/api/agent-arena",json=payload,headers=headers(csrf))
        self.assertEqual(duplicate.status_code,200,duplicate.text)
        self.assertEqual(duplicate.json()["id"],item["id"])
        conflict=c.post("/api/agent-arena",json={**payload,"title":"A changed comparison"},
                        headers=headers(csrf))
        self.assertEqual(conflict.status_code,409,conflict.text)
        rows=c.get("/api/agent-arena").json()["comparisons"]
        self.assertEqual(sum(x["id"]==item["id"] for x in rows),1)
        other,other_csrf=self.signup()
        self.assertEqual(other.get("/api/agent-arena/"+item["id"]).status_code,404)
        self.assertEqual(other.post("/api/agent-arena/"+item["id"]+"/review",
          json={"winner":"b","notes":"An independent preference review"},
          headers=headers(other_csrf)).status_code,404)

    def test_access_boundaries_invalid_profile_and_knowledge(self):
        c,csrf=self.signup()
        created=c.post("/api/agent-dna",json={"preset_id":"research_analyst"},
                       headers=headers(csrf)).json()
        aid=created["agent_id"]
        p=c.get("/api/agent-dna/"+aid).json()["profile"]
        p["knowledge_ids"]=["wos_000000000000000000000000"]
        rejected=c.put("/api/agent-dna/"+aid,json={"expected_revision":1,"profile":p},
                       headers=headers(csrf))
        self.assertEqual(rejected.status_code,404,rejected.text)
        p["knowledge_ids"]=[]
        p["traits"]["empathy"]=101
        invalid=c.put("/api/agent-dna/"+aid,json={"expected_revision":1,"profile":p},
                      headers=headers(csrf))
        self.assertEqual(invalid.status_code,422,invalid.text)
        self.assertEqual(c.get("/api/agent-dna/"+aid).json()["revision"],1)


if __name__=="__main__":
    unittest.main()
