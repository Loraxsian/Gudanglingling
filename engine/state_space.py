"""
Modul 3.2: Pemodelan Ruang Keadaan (State-Space Representation)
Materi Perkuliahan Artificial Intelligence — Dosen: Bapak Deosa Putra Caniago, M.Kom

Model State:
S = < Q, Sigma, delta, s0, G >

Himpunan State (Q):
- S0: AUTH_PIN           -> Autentikasi PIN Keamanan Keluarga
- S1: SELECT_ITEM        -> Pemilihan Alat yang Ingin Dipinjam
- S2: PHYSICAL_CHECK     -> Pengecekan Kondisi Fisik Komponen Alat (F01 - F12)
- S3: BORROWER_CHECK     -> Triase Profil Peminjam & Lingkungan Kerja (F13 - F20)
- S4: INFERENCE_CALC     -> Eksekusi Forward Chaining, CF Combine, dan h(S)
- G:  DECISION_ACTION    -> Zona Keputusan, Tindakan Keselamatan, & WhatsApp Click-to-Chat
"""

from typing import Dict, Any, List, Optional
from config import DEFAULT_FAMILY_PIN, SECONDARY_FAMILY_PIN
from engine.knowledge_base import FACTS, DECISIONS, Fact
from engine.forward_chaining import ForwardChainingEngine
from engine.heuristic_risk import HeuristicRiskEngine


class ConversationState:
    AUTH_PIN = "S0_AUTH_PIN"
    SELECT_ITEM = "S1_SELECT_ITEM"
    PHYSICAL_CHECK = "S2_PHYSICAL_CHECK"
    BORROWER_CHECK = "S3_BORROWER_CHECK"
    DECISION_ACTION = "G_DECISION_ACTION"


# Opsi Certainty Factor untuk Pengguna (Pilihan Jawaban Percakapan)
CF_OPTIONS = [
    {"label": "Tidak Ada / Normal", "value": 0.0, "badge": "Normal"},
    {"label": "Sedikit / Ragu-Ragu", "value": 0.4, "badge": "40%"},
    {"label": "Cukup Yakin Ada", "value": 0.6, "badge": "60%"},
    {"label": "Yakin / Jelas Terlihat", "value": 0.8, "badge": "80%"},
    {"label": "Sangat Yakin / Parah", "value": 1.0, "badge": "100%"}
]


class StateSpaceSession:
    def __init__(self, session_id: str):
        self.session_id: str = session_id
        self.current_state: str = ConversationState.AUTH_PIN
        self.is_authenticated: bool = False
        self.selected_item: Optional[Dict[str, Any]] = None
        self.borrower_name: str = ""
        self.borrower_phone: str = ""
        self.expected_days: int = 1
        self.facts_collected: Dict[str, float] = {}  # { "F01": 0.8, ... }
        self.question_queue: List[str] = []
        self.current_question_index: int = 0
        self.final_result: Optional[Dict[str, Any]] = None

    def authenticate(self, pin: str) -> Dict[str, Any]:
        """Transisi dari S0_AUTH_PIN -> S1_SELECT_ITEM jika PIN valid."""
        clean_pin = pin.strip()
        if clean_pin in (DEFAULT_FAMILY_PIN, SECONDARY_FAMILY_PIN):
            self.is_authenticated = True
            self.current_state = ConversationState.SELECT_ITEM
            return {
                "success": True,
                "message": "Autentikasi PIN Berhasil! Halo, selamat datang di GudangLingling AI.",
                "next_state": self.current_state
            }
        return {
            "success": False,
            "message": "PIN Keamanan salah! Silakan gunakan PIN keluarga (Default: 1234 atau 2422031).",
            "next_state": self.current_state
        }

    def start_assessment(self, item_data: Dict[str, Any], borrower_name: str, borrower_phone: str, days: int = 1):
        """Transisi dari S1_SELECT_ITEM -> S2_PHYSICAL_CHECK."""
        self.selected_item = item_data
        self.borrower_name = borrower_name or "Peminjam"
        self.borrower_phone = borrower_phone or ""
        self.expected_days = max(1, days)
        self.facts_collected = {}

        # Urutan pertanyaan fakta cerdas:
        # F01 - F12 (Fisik Alat), lalu F13 - F20 (Profil & Medan Kerja)
        self.question_queue = [f"F{i:02d}" for i in range(1, 21)]
        self.current_question_index = 0
        self.current_state = ConversationState.PHYSICAL_CHECK

    def submit_batch_assessment(self, item_data: Dict[str, Any], borrower_name: str, borrower_phone: str, days: int, facts: Dict[str, float]) -> Dict[str, Any]:
        """
        Fast-Track Smart Triage:
        Mengevaluasi fakta secara instan dalam 3 langkah ringkas,
        menjalankan Forward Chaining, CF Combine, dan Heuristic Risk,
        serta menghasilkan output Goal State G secara cepat dan akurat.
        """
        self.selected_item = item_data
        self.borrower_name = borrower_name or "Peminjam"
        self.borrower_phone = borrower_phone or ""
        self.expected_days = max(1, days)
        self.facts_collected = {k: round(float(v), 2) for k, v in facts.items() if float(v) > 0.0}
        return self.finalize_inference()

    def get_current_question(self) -> Optional[Dict[str, Any]]:
        """Mengambil pertanyaan fakta saat ini berdasarkan State aktif."""
        if self.current_question_index >= len(self.question_queue):
            return None

        fact_code = self.question_queue[self.current_question_index]
        fact_def: Fact = FACTS.get(fact_code)

        if not fact_def:
            return None

        # Evaluasi transisi state S2 -> S3 di tengah antrean pertanyaan
        if int(fact_code[1:]) >= 13 and self.current_state == ConversationState.PHYSICAL_CHECK:
            self.current_state = ConversationState.BORROWER_CHECK

        total_q = len(self.question_queue)
        progress_pct = int(((self.current_question_index) / total_q) * 100)

        return {
            "fact_code": fact_code,
            "name": fact_def.name,
            "prompt": fact_def.question_prompt,
            "category": fact_def.category,
            "is_critical": fact_def.is_critical_red_flag,
            "options": CF_OPTIONS,
            "current_index": self.current_question_index + 1,
            "total_questions": total_q,
            "progress_pct": progress_pct,
            "state": self.current_state
        }

    def answer_question(self, cf_value: float) -> Optional[Dict[str, Any]]:
        """Mencatat nilai CF user untuk fakta saat ini dan memajukan pointer pertanyaan."""
        if self.current_question_index < len(self.question_queue):
            fact_code = self.question_queue[self.current_question_index]
            self.facts_collected[fact_code] = round(float(cf_value), 2)
            self.current_question_index += 1

        # Cek apakah seluruh pertanyaan sudah dijawab
        if self.current_question_index >= len(self.question_queue):
            # Transisi ke State G (Goal State)
            return self.finalize_inference()

        return self.get_current_question()

    def finalize_inference(self) -> Dict[str, Any]:
        """
        Transisi S3 -> S4 -> G_DECISION_ACTION
        Menjalankan Forward Chaining + CF Combine + Heuristic Risk Evaluation.
        """
        self.current_state = ConversationState.DECISION_ACTION

        # 1. Eksekusi Forward Chaining & CF Combine
        inference_out = ForwardChainingEngine.infer(self.facts_collected)

        # 2. Eksekusi Heuristic Risk Triaging h(S)
        heuristic_out = HeuristicRiskEngine.evaluate_risk(self.facts_collected, item=self.selected_item)

        # 3. Rakit Format Output Keputusan Terpadu
        primary_dec = inference_out.get("primary_decision")

        # Jika zona MERAH, keputusan utama diprioritaskan K03 demi keselamatan
        if heuristic_out["zone"] == "RED" and primary_dec and primary_dec["code"] != "K03":
            # Override primary decision to Red Flag K03 jika keselamatan terancam
            k03 = DECISIONS["K03"]
            primary_dec = {
                "code": "K03",
                "name": k03.name,
                "description": k03.description,
                "recommendation": k03.action_recommendation,
                "cf_combined": 0.95,
                "percentage": 95.0,
                "supporting_rules_count": 1,
                "audit_steps": []
            }

        # 4. Generate Link WhatsApp (Click-to-chat)
        wa_text = self._build_whatsapp_message(primary_dec, heuristic_out)
        import urllib.parse
        encoded_wa = urllib.parse.quote(wa_text)
        clean_phone = self.borrower_phone.replace("+", "").replace("-", "").replace(" ", "")
        wa_url = f"https://wa.me/{clean_phone}?text={encoded_wa}" if clean_phone else f"https://wa.me/?text={encoded_wa}"

        result = {
            "session_id": self.session_id,
            "item": self.selected_item,
            "borrower": {
                "name": self.borrower_name,
                "phone": self.borrower_phone,
                "days": self.expected_days
            },
            "primary_decision": primary_dec,
            "all_decisions": inference_out.get("all_decisions", []),
            "fired_rules": inference_out.get("fired_rules", []),
            "heuristic_evaluation": heuristic_out,
            "whatsapp": {
                "raw_text": wa_text,
                "direct_url": wa_url
            },
            "academic_meta": {
                "mahasiswa": "Liana Sry Astuti",
                "nim": "2422031",
                "prodi": "Teknik Komputer - ITEBA",
                "dosen": "Bapak Deosa Putra Caniago, M.Kom",
                "matkul": "Artificial Intelligence"
            }
        }

        self.final_result = result
        return result

    def _build_whatsapp_message(self, decision: Dict[str, Any], heuristic: Dict[str, Any]) -> str:
        """Membuat teks template konfirmasi WhatsApp ramah pengguna & berkekuatan bukti."""
        item_name = self.selected_item.get("name", "Barang") if self.selected_item else "Barang"
        advice = heuristic.get("safety_advice", "Barang dalam kondisi baik dan layak pakai.")
        zone = heuristic.get("zone", "GREEN")
        borrower = (self.borrower_name or "Warga").strip()
        display_borrower = " ".join(w[:1].upper() + w[1:] for w in borrower.split())

        if zone == "RED":
            return (
                f"Halo *{display_borrower}*,\n\n"
                f"Mohon maaf, pengajuan peminjaman *{item_name}* belum dapat diproses karena kondisi barang sedang bermasalah:\n\n"
                f"- *Status Kondisi:* Tidak Layak Pakai (Perlu Servis)\n"
                f"- *Catatan:* {advice}\n\n"
                "Barang sementara dikarantina demi keamanan bersama. Terima kasih!"
            )

        wa_status = "Baik & Layak Pakai (Aman)" if zone == "GREEN" else "Layak Pakai (Perlu Perhatian)"
        return (
            f"Halo *{display_borrower}*,\n\n"
            "Peminjaman barang di *GudangLingling* sudah tercatat dengan detail berikut:\n\n"
            f"- *Barang:* {item_name}\n"
            f"- *Durasi:* {self.expected_days} hari\n"
            f"- *Status Kondisi:* {wa_status}\n"
            f"- *Catatan:* {advice}\n\n"
            "Mohon dijaga baik-baik dan dikembalikan tepat waktu ya. Terima kasih!"
        )
