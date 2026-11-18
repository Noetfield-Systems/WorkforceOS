"""Regression tests: Founder cinematic visual references are implemented in actual
first-party assets, not replaced by external robot photos or screenshots."""
from __future__ import annotations
import hashlib
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.workforce_roster import ROSTER

ROOT=Path(__file__).resolve().parents[1]

class CinematicCharacterContractTests(unittest.TestCase):
    def test_exactly_33_distinct_first_party_portrait_assets(self):
        ids={p["id"] for p in ROSTER}
        self.assertEqual(len(ids),33)
        directory=ROOT/"public"/"characters"
        files=sorted(directory.glob("*.webp"))
        self.assertEqual({file.stem for file in files},ids)
        hashes=set()
        for file in files:
            with self.subTest(name=file.name):
                data=file.read_bytes()
                self.assertGreater(len(data),9000)
                self.assertEqual(data[:4],b"RIFF")
                self.assertEqual(data[8:12],b"WEBP")
                hashes.add(hashlib.sha256(data).hexdigest())
        self.assertEqual(len(hashes),33,"Character portraits cannot be duplicated")

    def test_photo_media_and_reference_css_are_integrated(self):
        art=(ROOT/"public"/"agent-art.js").read_text()
        self.assertIn('src="/static/characters/',art)
        self.assertIn('cinematic-portrait-placeholder',art)
        self.assertNotIn('images.unsplash.com/',art)
        stylesheet=(ROOT/"public"/"premium-reference-v9.css").read_text()
        self.assertIn('.cinematic-character',stylesheet)
        self.assertIn('.scene-agent-pair',stylesheet)
        self.assertIn('.featured-agent-grid',stylesheet)
        with TestClient(app) as client:
            for route in ("/","/marketplace","/agents/community_builder","/arena","/creators"):
                with self.subTest(route=route):
                    response=client.get(route)
                    self.assertEqual(response.status_code,200)
                    self.assertIn("premium-reference-v9.css",response.text)
            self.assertIn("premium-reference-v9.css",client.get("/agent-studio").text)
            for id in ("lyra","orion","archive_researcher","sable","community_builder"):
                response=client.get("/static/characters/"+id+".webp")
                self.assertEqual(response.status_code,200)
                self.assertEqual(response.headers.get("content-type"),"image/webp")

if __name__=="__main__":
    unittest.main()
