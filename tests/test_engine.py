"""
Unit Testing untuk 3 Modul AI GudangLingling
Mata Kuliah: Artificial Intelligence — Dosen: Bapak Deosa Putra Caniago, M.Kom
Pengembang: Liana Sry Astuti (NIM: 2422031)
"""

import sys
from pathlib import Path
import unittest

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config import DEFAULT_FAMILY_PIN
from engine.certainty_factor import CertaintyFactorEngine
from engine.heuristic_risk import HeuristicRiskEngine
from engine.forward_chaining import ForwardChainingEngine
from engine.state_space import StateSpaceSession, ConversationState


class TestAIEngine(unittest.TestCase):
    def test_certainty_factor_combine_positive(self):
        """Uji rumus CF_combine untuk dua nilai positif: CF1 + CF2 * (1 - CF1)"""
        cf1 = 0.8
        cf2 = 0.6
        expected = round(0.8 + 0.6 * (1.0 - 0.8), 4)  # 0.8 + 0.12 = 0.92
        result = CertaintyFactorEngine.combine_cf(cf1, cf2)
        self.assertEqual(result, expected)
        self.assertEqual(result, 0.92)

    def test_certainty_factor_rule_calculation(self):
        """Uji rumus CF(H, E) = CF(E) * CF_pakar"""
        premise_cf = 0.8
        cf_pakar = 0.9
        expected = round(0.8 * 0.9, 4)  # 0.72
        result = CertaintyFactorEngine.calculate_rule_cf(premise_cf, cf_pakar)
        self.assertEqual(result, expected)

    def test_forward_chaining_electrical_hazard(self):
        """Uji Forward Chaining: Fakta F01 (Kabel Terkelupas) harus memicu Rule R01 -> K03"""
        facts = {"F01": 0.8}
        result = ForwardChainingEngine.infer(facts)
        primary = result["primary_decision"]

        self.assertIsNotNone(primary)
        self.assertEqual(primary["code"], "K03")
        self.assertGreaterEqual(primary["percentage"], 70.0)

    def test_heuristic_risk_green_zone(self):
        """Uji Kasus Normal / Zona Hijau: Tanpa red flag atau hanya fakta mikro F20"""
        facts = {"F20": 0.4}  # Pekerjaan mikro
        eval_result = HeuristicRiskEngine.evaluate_risk(facts)

        self.assertEqual(eval_result["zone"], "GREEN")
        self.assertLess(eval_result["heuristic_score"], 30.0)
        self.assertEqual(eval_result["action_code"], "APPROVE")

    def test_heuristic_risk_critical_override(self):
        """Uji Critical Red Flag Override: F04 (Bodi Nyetrum) memicu lonjakan skor ke Zona Merah"""
        facts = {"F04": 0.8}
        eval_result = HeuristicRiskEngine.evaluate_risk(facts)

        self.assertEqual(eval_result["zone"], "RED")
        self.assertGreaterEqual(eval_result["heuristic_score"], 70.0)
        self.assertTrue(eval_result["critical_override"])

    def test_state_space_flow(self):
        """Uji Transisi State-Space dari S0 -> S1 -> S2/S3 -> G"""
        session = StateSpaceSession("test-session-001")
        self.assertEqual(session.current_state, ConversationState.AUTH_PIN)

        # Autentikasi salah
        wrong_auth = session.authenticate("0000000")
        self.assertFalse(wrong_auth["success"])

        # Autentikasi benar
        auth_res = session.authenticate(DEFAULT_FAMILY_PIN)
        self.assertTrue(auth_res["success"])
        self.assertEqual(session.current_state, ConversationState.SELECT_ITEM)

        # Mulai penilaian alat
        sample_item = {"id": 1, "name": "Bor Listrik Impact", "status": "AVAILABLE"}
        session.start_assessment(sample_item, "Budi Santoso", "08123456789", 2)
        self.assertEqual(session.current_state, ConversationState.PHYSICAL_CHECK)

        # Jawab semua pertanyaan dengan normal (0.0)
        for _ in range(20):
            session.answer_question(0.0)

        # Harus mencapai State G
        self.assertEqual(session.current_state, ConversationState.DECISION_ACTION)
        self.assertIsNotNone(session.final_result)
        self.assertEqual(session.final_result["heuristic_evaluation"]["zone"], "GREEN")


if __name__ == "__main__":
    unittest.main()
