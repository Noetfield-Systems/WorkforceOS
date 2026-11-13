"""Evidence-first candidate routing is honest about missing proof and real demand."""
import unittest

from app.people_intelligence import evidence_profile, keywords, rank_related


class CandidateIntelligenceTests(unittest.TestCase):
    def candidate(self):
        return {
            "case_id": "opp_001", "source_intake_id": "INT-AAA111222333",
            "source": "linkedin", "venture": "noetfield",
            "skills": "Python, PostgreSQL, API integration and testing",
            "focus": "engineering", "desired_role": "Backend engineer",
            "intent": "I can help deliver Python API integrations with PostgreSQL tests.",
            "availability": "exploring", "portfolio_url": "",
            "linkedin_url": "", "source_message": "",
        }

    def test_only_presence_measured_no_skill_or_hiring_score(self):
        c=self.candidate()
        verdict=evidence_profile(c)
        self.assertEqual(verdict["canonical_intake_id"],"INT-AAA111222333")
        self.assertIn("portfolio_link_supplied",verdict["missing_evidence_fields"])
        self.assertIn("skills_declared",verdict["present_evidence_fields"])
        self.assertFalse(verdict["claims_verified"])
        self.assertFalse(verdict["agent_work_dispatched"])
        self.assertIn("work sample",verdict["next_action_suggestion"])

    def test_match_only_same_venture_real_opportunity_with_keyword_overlap(self):
        candidate=self.candidate()
        offers=[
            {"id":"opp_customer","venture":"noetfield","kind":"customer",
             "intent":"A Python PostgreSQL migration and API integration.",
             "status":"in_review"},
            {"id":"opp_other","venture":"buildrelay","kind":"customer",
             "intent":"Python PostgreSQL API integration.",
             "status":"new"},
            {"id":"opp_closed","venture":"noetfield","kind":"customer",
             "intent":"Python API work.","status":"won"},
            {"id":"opp_fake","venture":"noetfield","kind":"partnership",
             "intent":"Python API work.","status":"new"},
            {"id":"opp_irrelevant","venture":"noetfield","kind":"customer",
             "intent":"HVAC plumbing emergency dispatch", "status":"new"},
        ]
        matches=rank_related(candidate,offers)
        self.assertEqual([x["case_id"] for x in matches],["opp_customer"])
        self.assertFalse(matches[0]["verified_open_assignment"])
        self.assertEqual(matches[0]["match_status"],
                         "RELATED_INQUIRY_REQUIRES_OPERATOR_REVIEW")

    def test_never_merge_other_ventures_or_fabricate_opportunity(self):
        candidate=self.candidate()
        candidate["venture"]="trustfield"
        self.assertEqual(rank_related(candidate,[{
            "id":"a","venture":"trustfield","kind":"customer",
            "intent":"Python API","status":"new"}]),[])
        candidate["venture"]="noetfield"
        self.assertEqual(rank_related(candidate,[]),[])
        self.assertNotIn("project",keywords("Project and THE work"))
