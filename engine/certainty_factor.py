"""
Modul 6.7: Mesin Perhitungan Certainty Factor (CF)
Berdasarkan Teori Shortliffe & Buchanan (Sistem Pakar MYCIN)
Materi Perkuliahan Artificial Intelligence — Dosen: Bapak Deosa Putra Caniago, M.Kom

Rumus Inti:
1. CF Gejala Tunggal / Kaidah:
   CF(H, E) = CF(E) * CF_pakar
   di mana CF(E) = min(CF_user) jika operator AND, atau max(CF_user) jika operator OR.

2. Kombinasi Dua Nilai CF Hipotesis yang Sama:
   - Jika CF1 > 0 dan CF2 > 0:
     CF_combine(CF1, CF2) = CF1 + CF2 * (1 - CF1)
   - Jika CF1 < 0 dan CF2 < 0:
     CF_combine(CF1, CF2) = CF1 + CF2 * (1 + CF1)
   - Jika berbeda tanda:
     CF_combine(CF1, CF2) = (CF1 + CF2) / (1 - min(|CF1|, |CF2|))
"""

from typing import List, Dict, Any, Tuple


class CertaintyFactorEngine:
    @staticmethod
    def calculate_premise_cf(facts_cf: Dict[str, float], premises: List[str], operator: str) -> float:
        """
        Menghitung nilai CF(E) dari kumpulan premis fakta yang diinputkan pengguna.
        Operator AND menggunakan MIN, Operator OR menggunakan MAX.
        """
        if not premises:
            return 0.0

        values = [facts_cf.get(f_code, 0.0) for f_code in premises]

        if operator.upper() == "OR":
            return max(values)
        else:  # Default AND
            return min(values)

    @staticmethod
    def calculate_rule_cf(premise_cf: float, cf_pakar: float) -> float:
        """
        Menghitung CF(H, E) = CF(E) * CF_pakar
        """
        return round(premise_cf * cf_pakar, 4)

    @staticmethod
    def combine_cf(cf1: float, cf2: float) -> float:
        """
        Mengombinasikan dua nilai CF untuk hipotesis/keputusan yang sama.
        """
        if cf1 >= 0 and cf2 >= 0:
            combined = cf1 + cf2 * (1.0 - cf1)
        elif cf1 < 0 and cf2 < 0:
            combined = cf1 + cf2 * (1.0 + cf1)
        else:
            denom = 1.0 - min(abs(cf1), abs(cf2))
            if denom == 0:
                combined = 1.0
            else:
                combined = (cf1 + cf2) / denom

        return round(max(-1.0, min(1.0, combined)), 4)

    @classmethod
    def combine_multiple(cls, cf_list: List[float]) -> Tuple[float, List[Dict[str, Any]]]:
        """
        Mengombinasikan deretan nilai CF secara berurutan dan menyimpan jejak audit langkah perhitungannya
        (academic audit trail) untuk transparansi penilaian dosen.
        """
        if not cf_list:
            return 0.0, []

        steps = []
        current = cf_list[0]
        steps.append({
            "step": 1,
            "cf_input": current,
            "formula": "Inisialisasi CF_1",
            "cf_result": current
        })

        for i in range(1, len(cf_list)):
            next_cf = cf_list[i]
            prev = current
            current = cls.combine_cf(prev, next_cf)
            steps.append({
                "step": i + 1,
                "cf_prev": prev,
                "cf_input": next_cf,
                "formula": f"{prev:.4f} + {next_cf:.4f} * (1 - {prev:.4f})",
                "cf_result": current
            })

        return current, steps
