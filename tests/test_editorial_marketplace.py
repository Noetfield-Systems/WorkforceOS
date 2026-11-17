"""Editorial Agent Marketplace v4 — real character product invariants.

No visual or commercial mock state is allowed to masquerade as a real listing,
customer transaction, review, or agent execution. The catalog contains 12
actual createable presets and the original published creator templates.
"""
import sys
import os
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
os.environ["ENVIRONMENT"]="development"
os.environ.pop("WORKFORCE_FABRIC_GATEWAY_KEY",None)
from app.main import app
from app.agent_dna import preset_profile, compile_instructions

class EditorialMarketplaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client=TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None,None,None)

    def test_real_catalog_supports_distinct_role_archetypes(self):
        catalog=self.client.get("/api/agent-dna/catalog")
        self.assertEqual(catalog.status_code,200)
        presets=catalog.json()["presets"]
        self.assertEqual(len(presets),12)
        self.assertEqual(len({p["id"] for p in presets}),12)
        self.assertEqual(len({p["profile"]["name"] for p in presets}),12)
        self.assertEqual(len({p["profile"]["role"] for p in presets}),12)
        for key in ("archive_researcher","financial_analyst","operations_director",
                    "customer_advocate","strategy_advisor","field_observer"):
            p=preset_profile(key)
            self.assertTrue(p["mission"])
            self.assertGreater(len(p["backstory"]),30)
            compiled=compile_instructions(p)
            self.assertIn(p["mission"],compiled)
            self.assertIn(p["backstory"],compiled)
        self.assertFalse(catalog.json()["capabilities"]["custom_tool_grants"])
        self.assertFalse(catalog.json()["capabilities"]["marketplace_checkout"])

    def test_real_website_sources_no_fabricated_commerce(self):
        html=self.client.get("/")
        self.assertEqual(html.status_code,200)
        self.assertIn("/static/marketplace-v4.css",html.text)
        self.assertIn("/static/marketplace.js",html.text)
        studio=self.client.get("/agent-studio")
        self.assertEqual(studio.status_code,200)
        self.assertIn("/static/agent-studio-v4.css",studio.text)
        for path in ("/static/marketplace-v4.css","/static/agent-studio-v4.css"):
            r=self.client.get(path)
            self.assertEqual(r.status_code,200,r.text[:120])
            self.assertGreater(len(r.content),4000)
        javascript=(ROOT/"public/marketplace.js").read_text()
        self.assertIn("archive_researcher",javascript)
        self.assertIn("style-filters",javascript)
        self.assertIn("source-backed",javascript.lower())
        self.assertNotIn("$12,430",javascript)
        self.assertNotIn("2,843 reviews",javascript)
        self.assertNotIn("100K+",javascript)
        self.assertNotIn("4.9 (2.4k)",javascript)
        gallery=self.client.get("/api/agent-dna/gallery")
        self.assertFalse(gallery.json()["selling_enabled"])

    def test_existing_customer_workspace_and_agent_dna_still_served(self):
        self.assertEqual(self.client.get("/app").status_code,200)
        self.assertEqual(self.client.get("/api/agent-dna/gallery").status_code,200)
        for url in ("/","/marketplace","/agents/archive_researcher",
                    "/agent-studio?template=archive_researcher","/arena","/creators","/pricing"):
            self.assertEqual(self.client.get(url).status_code,200,url)

if __name__=="__main__":
    unittest.main()
