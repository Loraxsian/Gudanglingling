"""
Modul 6.7: Mesin Inferensi Forward Chaining (Data-Driven Inference)
Materi Perkuliahan Artificial Intelligence — Dosen: Bapak Deosa Putra Caniago, M.Kom

Forward Chaining bekerja mencocokkan fakta-fakta yang ada di Working Memory
dengan premis pada basis kaidah produksi (R01 - R15). Setiap kaidah yang premisnya
terpenuhi akan dieksekusi (fired) untuk menghasilkan hipotesis keputusan (K01 - K05),
lalu dihitung akumulasi Certainty Factor gabungannya.
"""

from typing import Dict, Any, List
from engine.knowledge_base import RULES, DECISIONS, Rule, Decision
from engine.certainty_factor import CertaintyFactorEngine


class ForwardChainingEngine:
    @classmethod
    def infer(cls, facts_cf: Dict[str, float]) -> Dict[str, Any]:
        """
        Menjalankan proses penalaran maju (Forward Chaining) terhadap input fakta.
        Input: facts_cf = {"F01": 0.8, "F03": 0.6, ...}
        """
        # Himpunan keputusan yang didukung oleh kaidah yang fired
        # Struktur: { "K03": [cf_rule1, cf_rule2], ... }
        hypothesis_cf_map: Dict[str, List[float]] = {}
        fired_rules: List[Dict[str, Any]] = []

        # 1. Evaluasi Kaidah Produksi R01 - R15
        for rule in RULES:
            if rule.operator == "DEFAULT_OPTIMAL":
                # Kaidah R14: Layak Pakai Optimal jika tidak ada indikasi bahaya
                continue

            premise_cf = CertaintyFactorEngine.calculate_premise_cf(
                facts_cf, rule.premises, rule.operator
            )

            # Kaidah dieksekusi jika nilai premis > 0
            if premise_cf > 0.0:
                cf_rule = CertaintyFactorEngine.calculate_rule_cf(premise_cf, rule.cf_pakar)

                fired_rules.append({
                    "rule_code": rule.code,
                    "premises": rule.premises,
                    "operator": rule.operator,
                    "premise_cf": round(premise_cf, 4),
                    "cf_pakar": rule.cf_pakar,
                    "cf_rule": cf_rule,
                    "conclusion": rule.conclusion,
                    "explanation": rule.explanation
                })

                if rule.conclusion not in hypothesis_cf_map:
                    hypothesis_cf_map[rule.conclusion] = []
                hypothesis_cf_map[rule.conclusion].append(cf_rule)

        # 2. Jika tidak ada kaidah kerusakan yang fired, aktifkan Kaidah Default R14 (K01)
        if not fired_rules:
            r14 = next((r for r in RULES if r.code == "R14"), None)
            if r14:
                cf_optimal = 0.95
                fired_rules.append({
                    "rule_code": r14.code,
                    "premises": ["Semua indikator normal / tidak ada red flag"],
                    "operator": "DEFAULT_OPTIMAL",
                    "premise_cf": 1.0,
                    "cf_pakar": r14.cf_pakar,
                    "cf_rule": cf_optimal,
                    "conclusion": r14.conclusion,
                    "explanation": r14.explanation
                })
                hypothesis_cf_map[r14.conclusion] = [cf_optimal]

        # 3. Hitung CF Combine untuk setiap kesimpulan hipotesis
        conclusion_results: List[Dict[str, Any]] = []

        for conc_code, cf_list in hypothesis_cf_map.items():
            combined_cf, audit_steps = CertaintyFactorEngine.combine_multiple(cf_list)
            decision_info: Decision = DECISIONS.get(conc_code)

            conclusion_results.append({
                "code": conc_code,
                "name": decision_info.name if decision_info else conc_code,
                "description": decision_info.description if decision_info else "",
                "recommendation": decision_info.action_recommendation if decision_info else "",
                "cf_combined": combined_cf,
                "percentage": round(combined_cf * 100.0, 2),
                "supporting_rules_count": len(cf_list),
                "audit_steps": audit_steps
            })

        # Urutkan berdasarkan Certainty Factor tertinggi
        conclusion_results.sort(key=lambda x: x["cf_combined"], reverse=True)

        primary_conclusion = conclusion_results[0] if conclusion_results else None

        return {
            "primary_decision": primary_conclusion,
            "all_decisions": conclusion_results,
            "fired_rules": fired_rules,
            "working_memory_facts": {k: v for k, v in facts_cf.items() if v > 0.0}
        }
