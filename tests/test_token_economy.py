"""Web3-first Genesis economy contract and public-surface acceptance."""
import os
import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
os.environ["ENVIRONMENT"]="development"
from app.main import app

class TokenEconomyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c=TestClient(app)
        cls.c.__enter__()
    @classmethod
    def tearDownClass(cls):
        cls.c.__exit__(None,None,None)

    def test_canonical_token_model_and_launch_truth(self):
        r=self.c.get("/api/token-economy/status")
        self.assertEqual(r.status_code,200,r.text)
        d=r.json()
        self.assertEqual(d["product_direction"],"web3_agent_economy")
        self.assertEqual(d["participation_status"],"LIVE_OFFCHAIN")
        self.assertEqual(d["model_status"],"SCENARIO_NOT_OFFER")
        self.assertFalse(d["token_issued"])
        self.assertFalse(d["token_sale_open"])
        self.assertFalse(d["crypto_checkout_open"])
        self.assertIsNone(d["live_token_price_usd"])
        self.assertIsNone(d["token_symbol"])
        self.assertIsNone(d["contract_address"])
        m=d["scenario"]
        self.assertEqual(m["hypothetical_supply"],100_000_000)
        self.assertEqual(m["reference_price_usd"],.005)
        self.assertEqual(m["reference_fdv_usd"],500_000)
        self.assertEqual(sum(x["percent"] for x in m["allocation"]),100)
        self.assertEqual(sum(x["scenario_units"] for x in m["allocation"]),100_000_000)
        self.assertEqual({x["id"]:x["percent"] for x in m["allocation"]},
                         {"community":30,"ecosystem":25,"builders":20,
                          "treasury":15,"liquidity":10})

    def test_web3_public_routes_and_drift_protection(self):
        for page in ("/tokenomics","/economy"):
            response=self.c.get(page)
            self.assertEqual(response.status_code,200,page)
            self.assertIn("The workforce",response.text)
            self.assertIn("100M",response.text)
            self.assertIn("$0.005",response.text)
            self.assertIn("Not a live quote",response.text)
        home=self.c.get("/")
        self.assertEqual(home.status_code,200)
        self.assertIn("/tokenomics",home.text)
        help_page=self.c.get("/help")
        self.assertEqual(help_page.status_code,200)
        self.assertIn("GENESIS / TOKEN ECONOMY",help_page.text)
        self.assertNotIn("SOLO</span>",help_page.text)
        self.assertNotIn("BUILDER</span>",help_page.text)
        self.assertNotIn("$199",help_page.text)
        self.assertIn("support-form",help_page.text)
        genesis=self.c.get("/genesis/app")
        self.assertEqual(genesis.status_code,200)
        self.assertIn("Tokenomics & scenarios",genesis.text)
        self.assertIn("Daily claim & play",genesis.text)
        pricing_script=(ROOT/"public/marketplace.js").read_text()
        start=pricing_script.index("function pricing(){")
        end=pricing_script.index("function notFound(",start)
        self.assertIn("GENESIS / PRICE MODEL",pricing_script[start:end])
        self.assertNotIn("SOLO / $29",pricing_script[start:end])
