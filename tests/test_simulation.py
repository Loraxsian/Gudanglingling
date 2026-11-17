"""
Modul Simulasi & Validasi Kasus Uji Akademik GudangLingling AI
Mata Kuliah: Artificial Intelligence
Dosen: Bapak Deosa Putra Caniago, M.Kom
Pengembang: Liana Sry Astuti (NIM: 2422031) — Teknik Komputer ITEBA

Menyimulasikan 5 skenario nyata peminjaman peralatan rumah tangga dengan
kalkulasi step-by-step transparan (Forward Chaining + CF Combine + h(S))
untuk keperluan laporan akademik dan verifikasi hasil oleh dosen.
"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from engine.forward_chaining import ForwardChainingEngine
from engine.heuristic_risk import HeuristicRiskEngine
from engine.certainty_factor import CertaintyFactorEngine


# =================================================================
# DEFINISI 5 SKENARIO KASUS UJI AKADEMIK
# =================================================================

TEST_SCENARIOS = [
    {
        "id": "TC-01",
        "nama": "Skenario 1: ZONA HIJAU — Alat Prima & Peminjam Berpengalaman",
        "alat": "Bor Listrik Impact Drill (600W)",
        "peminjam": "Pak Hendra (Kontraktor Rumahan, 10 tahun pengalaman)",
        "deskripsi": (
            "Bor dalam kondisi sempurna: kabel mulus, steker kuat, suara halus, "
            "safety guard terpasang. Peminjam profesional berpengalaman, punya sarung "
            "tangan dan kacamata, akan dipakai di dalam ruangan kering."
        ),
        "facts_input": {
            # Semua fakta kerusakan = 0.0 (normal), hanya pekerjaan ringan F20
            "F01": 0.0, "F02": 0.0, "F03": 0.0, "F04": 0.0,
            "F05": 0.0, "F06": 0.0, "F07": 0.0, "F08": 0.0,
            "F09": 0.0, "F10": 0.0, "F11": 0.0, "F12": 0.0,
            "F13": 0.0, "F14": 0.0, "F15": 0.0, "F16": 0.0,
            "F17": 0.0, "F18": 0.0, "F19": 0.0, "F20": 0.4
        },
        "expected_zone": "GREEN",
        "expected_decision": "K01"
    },
    {
        "id": "TC-02",
        "nama": "Skenario 2: ZONA KUNING — Degradasi Komponen Mekanis",
        "alat": "Mesin Gerinda Tangan 4 Inch (540W)",
        "peminjam": "Mas Rudi (Pengalaman menengah, 3 tahun)",
        "deskripsi": (
            "Mata gerinda mulai terasa tumpul dan terdengar suara gesekan kasar dari bearing. "
            "Baut pengunci bilah sedikit kendor. Peminjam sudah terbiasa menggunakan gerinda "
            "dan memiliki sarung tangan kerja."
        ),
        "facts_input": {
            "F01": 0.0, "F02": 0.0, "F03": 0.0, "F04": 0.0,
            "F05": 0.8,  # Mata gerinda tumpul — Yakin
            "F06": 0.0, "F07": 0.6,  # Baut pengunci kendor — Cukup Yakin
            "F08": 0.0, "F09": 0.0, "F10": 0.6,  # Suara bearing berdecit — Cukup Yakin
            "F11": 0.0, "F12": 0.0,
            "F13": 0.0, "F14": 0.0, "F15": 0.0, "F16": 0.4,
            "F17": 0.0, "F18": 0.4, "F19": 0.0, "F20": 0.0
        },
        "expected_zone": "YELLOW",
        "expected_decision": "K02"
    },
    {
        "id": "TC-03",
        "nama": "Skenario 3: ZONA MERAH — Bahaya Fatal Kelistrikan (Critical Red Flag)",
        "alat": "High-Pressure Jet Cleaner (850W)",
        "peminjam": "Bu Siti (Pemula, hendak mencuci halaman saat hujan gerimis)",
        "deskripsi": (
            "Ditemukan kabel daya mesin cuci motor terkelupas di dekat sambungan. "
            "Rencananya akan digunakan di luar ruangan yang masih basah setelah hujan. "
            "Peminjam tidak pernah menggunakan alat berdaya tinggi sebelumnya dan tidak "
            "memiliki sarung tangan insulasi listrik."
        ),
        "facts_input": {
            "F01": 1.0,  # Kabel terkelupas — Sangat Yakin
            "F02": 0.6,  # Steker sedikit gosong
            "F03": 0.0, "F04": 0.0,
            "F05": 0.0, "F06": 0.0, "F07": 0.0, "F08": 0.0,
            "F09": 0.0, "F10": 0.0, "F11": 0.0, "F12": 0.0,
            "F13": 1.0,  # Peminjam pemula — Sangat Yakin
            "F14": 1.0,  # Tanpa APD — Sangat Yakin
            "F15": 0.8,  # Area basah/hujan — Yakin
            "F16": 0.0, "F17": 0.0, "F18": 0.0, "F19": 0.0, "F20": 0.0
        },
        "expected_zone": "RED",
        "expected_decision": "K03"
    },
    {
        "id": "TC-04",
        "nama": "Skenario 4: ZONA MERAH — Ketidaksesuaian Profil Peminjam (Anak di Bawah Umur)",
        "alat": "Mesin Potong Rumput Listrik (450W)",
        "peminjam": "Dito (13 tahun, hendak memotong rumput sendirian)",
        "deskripsi": (
            "Alat potong rumput dalam kondisi baik secara fisik. Namun peminjam adalah "
            "anak berusia 13 tahun yang ingin memotong rumput sendiri tanpa pendampingan "
            "orang tua. Senar potong berputar cepat sangat berbahaya bagi anak-anak."
        ),
        "facts_input": {
            "F01": 0.0, "F02": 0.0, "F03": 0.0, "F04": 0.0,
            "F05": 0.0, "F06": 0.0, "F07": 0.0, "F08": 0.0,
            "F09": 0.0, "F10": 0.0, "F11": 0.0, "F12": 0.0,
            "F13": 1.0,  # Pemula total
            "F14": 1.0,  # Tanpa APD
            "F15": 0.0, "F16": 0.0,
            "F17": 1.0,  # Di bawah umur — Sangat Yakin (Critical!)
            "F18": 0.0, "F19": 0.0, "F20": 0.0
        },
        "expected_zone": "RED",
        "expected_decision": "K04"
    },
    {
        "id": "TC-05",
        "nama": "Skenario 5: ZONA HIJAU — Rekomendasi Alat Alternatif (K05)",
        "alat": "Bor Listrik Impact Drill (600W)",
        "peminjam": "Ibu Rina (Pemula, hanya ingin pasang pigura foto)",
        "deskripsi": (
            "Peminjam meminta bor impact drill berdaya 600W yang terasa berlebihan "
            "untuk kebutuhan yang sangat kecil (memasang 2 paku dinding untuk pigura foto). "
            "Sistem akan merekomendasikan alat alternatif yang lebih ringan dan aman."
        ),
        "facts_input": {
            "F01": 0.0, "F02": 0.0, "F03": 0.0, "F04": 0.0,
            "F05": 0.0, "F06": 0.0, "F07": 0.0, "F08": 0.0,
            "F09": 0.0, "F10": 0.0, "F11": 0.0, "F12": 0.0,
            "F13": 1.0,  # Pemula
            "F14": 0.4,  # Mungkin ada APD sederhana
            "F15": 0.0, "F16": 0.0, "F17": 0.0, "F18": 0.0,
            "F19": 0.0,
            "F20": 1.0   # Pekerjaan mikro/estetika — Sangat Yakin
        },
        "expected_zone": "YELLOW",   # Pemula + tidak punya APD → tetap Bersyarat (benar secara ilmiah)
        "expected_decision": "K05"
    }
]


# =================================================================
# RUNNER SIMULASI — CETAK LAPORAN LENGKAP
# =================================================================

def print_separator(char="=", width=72):
    print(char * width)


def run_simulation(scenario: dict) -> dict:
    """Jalankan satu skenario dan kembalikan hasil lengkap."""
    fc_result = ForwardChainingEngine.infer(scenario["facts_input"])
    h_result = HeuristicRiskEngine.evaluate_risk(scenario["facts_input"])
    primary = fc_result.get("primary_decision")
    return {
        "scenario": scenario,
        "fc_result": fc_result,
        "h_result": h_result,
        "primary": primary
    }


def print_scenario_report(result: dict):
    sc = result["scenario"]
    fc = result["fc_result"]
    h = result["h_result"]
    primary = result["primary"]

    zone_icon = {"GREEN": "[HIJAU]", "YELLOW": "[KUNING]", "RED": "[MERAH]"}.get(h["zone"], "[ZONA]")
    pass_fail = "[PASS]" if (
        h["zone"] == sc["expected_zone"]
    ) else "[FAIL]"

    print_separator()
    print(f"  {sc['id']} — {sc['nama']}")
    print_separator()
    print(f"  Alat         : {sc['alat']}")
    print(f"  Peminjam     : {sc['peminjam']}")
    print(f"  Skenario     : {sc['deskripsi']}\n")

    # Input Fakta Aktif
    active_facts = {k: v for k, v in sc["facts_input"].items() if v > 0.0}
    print(f"  FAKTA AKTIF (Working Memory):")
    if active_facts:
        for code, cf in active_facts.items():
            from engine.knowledge_base import FACTS
            f = FACTS.get(code)
            fname = f.name[:48] if f else code
            print(f"    • {code}: {fname} → CF User: {cf}")
    else:
        print("    • (Tidak ada gejala terdeteksi — semua normal)")

    print()

    # Kaidah yang Aktif (Fired Rules)
    fired = fc.get("fired_rules", [])
    print(f"  KAIDAH YANG TERPICU (Forward Chaining — {len(fired)} rule(s)):")
    if fired:
        for r in fired:
            print(f"    • {r['rule_code']}: IF ({' ' + r['operator'] + ' '.join(r['premises'])}) → {r['conclusion']}")
            print(f"      Premis CF: {r['premise_cf']} × CF Pakar: {r['cf_pakar']} = CF Rule: {r['cf_rule']}")
    else:
        print("    • Tidak ada kaidah yang terpicu (Menggunakan Kaidah Default R14 → K01)")
    print()

    # Semua Kesimpulan + CF
    decisions = fc.get("all_decisions", [])
    print(f"  SEMUA HIPOTESIS & CERTAINTY FACTOR COMBINE:")
    for d in decisions:
        print(f"    • {d['code']} – {d['name']}")
        print(f"      CF Combine: {d['cf_combined']}  ({d['percentage']}%)")
        if d.get("audit_steps") and len(d["audit_steps"]) > 1:
            for step in d["audit_steps"]:
                if step["step"] > 1:
                    print(f"        [Langkah {step['step']}] {step['cf_prev']} + {step['cf_input']} × (1−{step['cf_prev']}) = {step['cf_result']}")
    print()

    # Heuristic Score
    print(f"  EVALUASI HEURISTIK TRIASE RISIKO [Modul 4.5]:")
    print(f"  Rumus: h(S) = min(100, Σ wᵢ × CF_user(Fᵢ))")
    breakdown = h.get("score_breakdown", [])
    total = 0.0
    for b in breakdown:
        sub = b["sub_score"]
        total += sub
        crit_flag = " [KRITIS]" if b["is_critical"] else ""
        print(f"    {b['code']} → {b['weight']} × {b['cf_user']} = {sub:.2f}{crit_flag}")

    if h.get("critical_override"):
        print(f"    [!] CRITICAL RED FLAG OVERRIDE diaktifkan! Skor raw ({total:.2f}) dinaikkan minimal 80.")

    print(f"    ──────────────────────────────────")
    print(f"    Skor Akhir h(S) = {h['heuristic_score']}")
    print()

    # Hasil Akhir
    print(f"  KEPUTUSAN FINAL:")
    print(f"  {zone_icon} Zona Triase  : {h['zone_label']}")
    print(f"  - Keputusan AI: {primary['code'] if primary else 'K01'} — {primary['name'] if primary else 'Layak Pakai Optimal'}")
    print(f"  - Panduan     : {h['safety_advice']}")
    print(f"  - Rekomendasi : {primary['recommendation'] if primary else '-'}")
    print()
    print(f"  VALIDASI EKSPEKTASI: {pass_fail}")
    if h["zone"] != sc["expected_zone"]:
        print(f"    ↳ Ekspektasi: {sc['expected_zone']} | Hasil Aktual: {h['zone']}")
    print()


def run_all():
    print_separator("=")
    print("  LAPORAN SIMULASI & VALIDASI KASUS UJI AKADEMIK")
    print("  Sistem Pakar GudangLingling AI")
    print()
    print("  Pengembang : Liana Sry Astuti (NIM: 2422031)")
    print("  Dosen      : Bapak Deosa Putra Caniago, M.Kom")
    print("  Program    : Teknik Komputer — ITEBA")
    print("  Matkul     : Artificial Intelligence")
    print_separator("=")
    print()

    passed = 0
    failed = 0

    for sc in TEST_SCENARIOS:
        result = run_simulation(sc)
        print_scenario_report(result)
        if result["h_result"]["zone"] == sc["expected_zone"]:
            passed += 1
        else:
            failed += 1

    # Ringkasan Akhir
    print_separator()
    print(f"  RINGKASAN HASIL VALIDASI SISTEM")
    print_separator("-")
    print(f"  Total Skenario Diuji  : {len(TEST_SCENARIOS)}")
    print(f"  PASS (Sesuai Ekspektasi): {passed} skenario")
    print(f"  FAIL (Tidak Sesuai)   : {failed} skenario")
    pct = (passed / len(TEST_SCENARIOS)) * 100
    print(f"  Akurasi Validasi      : {pct:.1f}%")
    print_separator()


if __name__ == "__main__":
    run_all()
