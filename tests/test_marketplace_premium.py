"""Public premium marketplace release smoke and source-truth tests.

The public site is a rendered client catalog of real curated presets and
opt-in community profiles, not a fixture database of sales or ratings.
"""
import os
import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
os.environ["ENVIRONMENT"]="development"
os.environ.pop("WORKFORCE_FABRIC_GATEWAY_KEY",None)

from app.main import app


class PremiumMarketplaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client=TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None,None,None)

    def test_public_routes_have_one_complete_document_shell(self):
        for path in ("/","/marketplace","/agents/research_analyst","/arena",
                     "/creators","/pricing"):
            with self.subTest(path=path):
                response=self.client.get(path)
                self.assertEqual(response.status_code,200,response.text[:600])
                self.assertIn("WorkforceOS",response.text)
                self.assertIn("/static/marketplace.css",response.text)
                self.assertIn("/static/marketplace.js",response.text)
                self.assertIn('id="content"',response.text)
                self.assertIn('id="site-header"',response.text)
                self.assertIn('href="/marketplace"',response.text)
                self.assertIn('href="/agent-studio"',response.text)
                self.assertIn('href="/arena"',response.text)

    def test_old_customer_workspace_is_preserved(self):
        response=self.client.get("/app")
        self.assertEqual(response.status_code,200)
        self.assertIn('id="auth-form"',response.text)
        self.assertIn('id="studio"',response.text)
        self.assertIn("/static/app.js",response.text)
        self.assertNotIn("/static/marketplace.js",response.text)

    def test_studio_remains_real_and_links_back_to_marketplace(self):
        response=self.client.get("/agent-studio")
        self.assertEqual(response.status_code,200)
        self.assertIn("Agent DNA Studio",response.text)
        self.assertIn('class="dna-cinematic-hero"',response.text)
        self.assertIn('href="/marketplace"',response.text)
        self.assertIn('href="/arena"',response.text)
        self.assertIn('href="/app"',response.text)
        self.assertIn('id="save-button"',response.text)
        self.assertIn('id="arena-form"',response.text)

    def test_static_assets_and_strict_cross_origin_policy(self):
        for path in ("/static/marketplace.js","/static/marketplace.css",
                     "/static/agent-studio.js","/static/agent-studio.css"):
            with self.subTest(path=path):
                response=self.client.get(path)
                self.assertEqual(response.status_code,200)
                self.assertGreater(len(response.content),1000)
                csp=response.headers.get("content-security-policy","")
                self.assertIn("default-src 'self'",csp)
                self.assertIn("https://images.unsplash.com",csp)
                self.assertIn("frame-ancestors 'none'",csp)

    def test_public_catalog_is_real_and_payment_claims_are_disabled(self):
        catalog=self.client.get("/api/agent-dna/catalog")
        self.assertEqual(catalog.status_code,200,catalog.text)
        self.assertEqual(len(catalog.json()["presets"]),6)
        self.assertFalse(catalog.json()["capabilities"]["marketplace_checkout"])
        self.assertFalse(catalog.json()["capabilities"]["custom_tool_grants"])
        gallery=self.client.get("/api/agent-dna/gallery")
        self.assertEqual(gallery.status_code,200)
        self.assertFalse(gallery.json()["selling_enabled"])
        for item in gallery.json()["community_templates"]:
            self.assertEqual(item["profile"]["knowledge_ids"],[])
            self.assertEqual(item["profile"]["requested_tools"],[])

    def test_assets_include_interactive_flows_and_responsive_panorama(self):
        js=(ROOT/"public/marketplace.js").read_text()
        css=(ROOT/"public/marketplace.css").read_text()
        studio=(ROOT/"public/agent-studio.js").read_text()
        self.assertIn('api("/api/agent-dna/gallery")',js)
        self.assertIn('api("/api/agent-arena","POST"',js)
        self.assertIn('api("/api/agent-arena/"+encodeURIComponent(id)+"/review"',js)
        self.assertIn('new URLSearchParams(location.search)',studio)
        self.assertIn('qs.has("community")',studio)
        self.assertIn('qs.has("template")',studio)
        self.assertIn("@media(max-width:700px)",css)
        self.assertIn("prefers-reduced-motion",css)
        self.assertIn("panoramic-band",css)
        self.assertNotIn("100K+",js)
        self.assertNotIn("2,843 reviews",js)
        self.assertNotIn("$12,430",js)


if __name__=="__main__":
    unittest.main()
