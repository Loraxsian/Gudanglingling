"""
Modul 4.5: Fungsi Evaluasi Heuristik Triase Risiko Keselamatan (Safety Risk Triaging)
Materi Perkuliahan Artificial Intelligence — Dosen: Bapak Deosa Putra Caniago, M.Kom

Fungsi Heuristik:
h(S) = min(100, SUM(w_i * CF_user(F_i)))

Di mana:
- S: State / Fakta kondisi alat dan peminjam saat ini
- w_i: Bobot bahaya indikator fakta (0 - 40)
- CF_user(F_i): Tingkat keyakinan pengguna terhadap gejala tersebut (0.0 - 1.0)

Triase Tiga Zona Keputusan:
1. ZONA HIJAU (h(S) < 30)       -> Layak Pakai Langsung (READY)
2. ZONA KUNING (30 <= h(S) < 70) -> Peminjaman Bersyarat / Wajib APD
3. ZONA MERAH (h(S) >= 70)      -> Ditolak & Lockout Karantina Perbaikan
"""

from typing import Dict, Any, List, Tuple
from engine.knowledge_base import FACTS, Fact


class HeuristicRiskEngine:
    @staticmethod
    def evaluate_risk(facts_input: Dict[str, float]) -> Dict[str, Any]:
        """
        Menghitung skor heuristik keselamatan h(S) dan menentukan zonasi triase.
        Input: facts_input = {"F01": 0.8, "F05": 0.6, ...}
        """
        raw_score = 0.0
        breakdown: List[Dict[str, Any]] = []
        critical_flags_detected: List[str] = []

        for f_code, cf_val in facts_input.items():
            if cf_val <= 0.0:
                continue

            fact_def: Fact = FACTS.get(f_code)
            if not fact_def:
                continue

            sub_score = fact_def.risk_weight * cf_val
            raw_score += sub_score

            breakdown.append({
                "code": f_code,
                "name": fact_def.name,
                "weight": fact_def.risk_weight,
                "cf_user": cf_val,
                "sub_score": round(sub_score, 2),
                "is_critical": fact_def.is_critical_red_flag
            })

            # Evaluasi Critical Red Flag
            # Jika fakta kritis diyakini dengan CF >= 0.6, sistem mengaktifkan override risiko tinggi
            if fact_def.is_critical_red_flag and cf_val >= 0.6:
                critical_flags_detected.append(f"{fact_def.code} - {fact_def.name}")

        # Override Penalti Bahaya Kritis (Safety First Override)
        critical_override = False
        if critical_flags_detected and raw_score < 70.0:
            raw_score = max(raw_score, 80.0)
            critical_override = True

        final_score = min(100.0, round(raw_score, 2))

        # Penentuan Zona Triase
        if final_score < 30.0:
            zone = "GREEN"
            zone_label = "ZONA HIJAU (Aman / Layak Pakai Optimal)"
            badge_color = "#10B981"  # Emerald Green
            action_code = "APPROVE"
            safety_advice = "Alat dalam kondisi aman dan terawat. Tetap berhati-hati saat menyalakan alat."
        elif final_score < 70.0:
            zone = "YELLOW"
            zone_label = "ZONA KUNING (Peminjaman Bersyarat & Perlu APD)"
            badge_color = "#F59E0B"  # Amber Yellow
            action_code = "CONDITIONAL"
            safety_advice = "Peminjaman diizinkan dengan pengawasan atau syarat wajib memakai APD lengkap (kacamata pengaman / sarung tangan tebal)."
        else:
            zone = "RED"
            zone_label = "ZONA MERAH (Ditolak / Lockout Karantina)"
            badge_color = "#EF4444"  # Rose Red
            action_code = "REJECT_LOCKOUT"
            safety_advice = "BAHAYA FATAL! Alat ini terdeteksi memiliki kerusakan serius/bahaya kelistrikan. Peminjaman DITOLAK demi mencegah kecelakaan kerja."

        return {
            "heuristic_score": final_score,
            "zone": zone,
            "zone_label": zone_label,
            "badge_color": badge_color,
            "action_code": action_code,
            "safety_advice": safety_advice,
            "critical_override": critical_override,
            "critical_flags": critical_flags_detected,
            "score_breakdown": breakdown
        }
