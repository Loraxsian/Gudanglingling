"""
Server Aplikasi GudangLingling AI
Menggunakan Standard Library Python (Zero-Dependency)
Menyediakan REST API untuk Mesin AI, Manajemen Foto Komparasi, Log Email, dan 3 Menu Utama.

Pengembang: Liana Sry Astuti (NIM: 2422031)
Dosen Pengampu: Bapak Deosa Putra Caniago, M.Kom
Program Studi: Teknik Komputer - ITEBA
"""

import sys
import os
import time
import json
import uuid
import base64
import mimetypes
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, quote

# Pastikan root direktori masuk ke path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import config
from database.db import (
    init_db,
    get_all_items,
    get_item_by_id,
    add_item,
    delete_item,
    update_item_status,
    save_borrowing_record,
    complete_return_check,
    get_borrowing_record_by_id,
    get_reminder_queue,
    get_borrowing_history,
    get_email_logs,
    log_email_archive,
    unlock_maintenance_item,
    get_auth_status,
    verify_user_credentials,
    change_user_password
)
from database.seed import seed_database  # Hanya panggil init_db() — tidak insert data
from engine.state_space import StateSpaceSession, CF_OPTIONS
from engine.knowledge_base import FACTS, DECISIONS, RULES
from engine.forward_chaining import ForwardChainingEngine
from engine.heuristic_risk import HeuristicRiskEngine

# Sesi percakapan aktif yang disimpan di memori
ACTIVE_SESSIONS = {}

# Proteksi Anti-Brute Force untuk Login PIN (maks 3 percobaan salah -> kunci 120 detik)
LOGIN_ATTEMPTS = {}
MAX_LOGIN_ATTEMPTS = 3
LOCKOUT_SECONDS = 120


def validate_borrow_duration(item, borrow_days: int):
    """
    Smart Rule Enforcement: Validasi batas maksimal durasi peminjaman
    berdasarkan kategori, daya listrik, dan tingkat bahaya alat.
    """
    if borrow_days < 1:
        return False, "Durasi peminjaman minimal adalah 1 hari.", 1

    cat = (item.get("category") or "").strip()
    power = int(item.get("power_watts") or 0)
    danger = (item.get("danger_level") or "SEDANG").upper()

    heavy_categories = {"Pertukangan Listrik", "Akses Ketinggian", "Peralatan Air & Cuci"}
    if cat in heavy_categories or power > 0 or danger in ("TINGGI", "SANGAT TINGGI"):
        max_days = 3
    else:
        max_days = 7

    if borrow_days > max_days:
        return (
            False,
            f"Aturan Sistem Pakar (Durasi Maksimal): Untuk alat kategori '{cat}', batas maksimal peminjaman adalah {max_days} hari agar warga lain tetap kebagian.",
            max_days,
        )
    return True, "", max_days


class ReusableThreadingServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class GudangLinglingRequestHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Header CORS agar aman jika diakses dari frontend terpisah
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _send_json(self, data, status_code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                raw_data = self.rfile.read(content_length).decode("utf-8")
                return json.loads(raw_data)
        except Exception:
            pass
        return {}

    def _serve_static_file(self, file_path: Path):
        if not file_path.exists() or file_path.is_dir():
            self.send_error(404, "File Not Found")
            return

        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            mime_type = "application/octet-stream"

        try:
            content = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", f"{mime_type}; charset=utf-8" if "text" in mime_type or "javascript" in mime_type else mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {e}")

    # =========================================================
    # GET ROUTER
    # =========================================================
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # 1. API: Info Akademik & Status Server
        if path == "/api/health":
            self._send_json({
                "status": "healthy",
                "app": "GudangLingling AI",
                "academic": {
                    "mahasiswa": "Liana Sry Astuti",
                    "nim": "2422031",
                    "prodi": "Teknik Komputer - ITEBA",
                    "dosen": "Bapak Deosa Putra Caniago, M.Kom",
                    "matkul": "Artificial Intelligence",
                    "modules": [
                        "Modul 3.2: State-Space Representation",
                        "Modul 6.7: Forward Chaining & Certainty Factor",
                        "Modul 4.5: Heuristic Risk Evaluation Function"
                    ]
                }
            })
            return

        # 1B. API: Cek Status Password Default (Login Page Note)
        if path == "/api/auth/status":
            self._send_json(get_auth_status())
            return

        # 2. API: Daftar Peralatan
        if path == "/api/items":
            items = get_all_items()
            self._send_json({"items": items})
            return

        # 3. API: Detail Peralatan Tunggal /api/items/<id>
        if path.startswith("/api/items/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[2].isdigit():
                item = get_item_by_id(int(parts[2]))
                if item:
                    self._send_json({"item": item})
                else:
                    self._send_json({"error": "Item tidak ditemukan"}, 404)
                return

        # 4. API: Riwayat Peminjaman & Log Triase
        if path == "/api/history":
            history = get_borrowing_history()
            self._send_json({"history": history})
            return

        # 5. API: Detail Peminjaman Tertentu /api/borrow-record/<id>
        if path.startswith("/api/borrow-record/"):
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[2].isdigit():
                record = get_borrowing_record_by_id(int(parts[2]))
                if record:
                    self._send_json({"record": record})
                else:
                    self._send_json({"error": "Data peminjaman tidak ditemukan"}, 404)
                return

        # 6. API: Antrean Pengingat (Reminder Queue untuk Menu 2: Message)
        if path == "/api/reminders":
            reminders = get_reminder_queue()
            self._send_json({"reminders": reminders})
            return

        # 7. API: Log Arsip Email (Email Backup Log untuk Menu 2: Message)
        if path == "/api/email-logs":
            logs = get_email_logs()
            self._send_json({"email_logs": logs})
            return

        # 8. API: Pengetahuan AI (Knowledge Base Inspection untuk Menu 3: FaQ)
        if path == "/api/knowledge-base":
            facts_list = [{
                "code": f.code, "name": f.name, "category": f.category,
                "risk_weight": f.risk_weight, "is_critical": f.is_critical_red_flag,
                "prompt": f.question_prompt
            } for f in FACTS.values()]

            rules_list = [{
                "code": r.code, "premises": r.premises, "operator": r.operator,
                "conclusion": r.conclusion, "cf_pakar": r.cf_pakar,
                "explanation": r.explanation
            } for r in RULES]

            decisions_list = [{
                "code": d.code, "name": d.name, "zone": d.default_zone,
                "description": d.description, "recommendation": d.action_recommendation
            } for d in DECISIONS.values()]

            self._send_json({
                "facts": facts_list,
                "rules": rules_list,
                "decisions": decisions_list
            })
            return

        # 9. Serving Static Uploaded Images (/uploads/...)
        if path.startswith("/uploads/"):
            rel_file = path.replace("/uploads/", "")
            target_photo = config.UPLOAD_DIR / rel_file
            if target_photo.exists() and target_photo.is_file():
                self._serve_static_file(target_photo)
                return

        # 10. Serving Static Frontend
        static_dir = BASE_DIR / "static"
        if path == "/" or path == "":
            self._serve_static_file(static_dir / "index.html")
            return

        # Static asset lookup
        target_file = static_dir / path.lstrip("/")
        if target_file.exists() and target_file.is_file():
            self._serve_static_file(target_file)
            return

        self.send_error(404, "Halaman Tidak Ditemukan")

    # =========================================================
    # POST ROUTER
    # =========================================================
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()

        # 1. API: Autentikasi Username/Password & PIN S0 (dengan Proteksi Anti-Brute Force)
        if path == "/api/auth":
            client_ip = self.client_address[0] if self.client_address else "unknown"
            now = time.time()
            attempt_info = LOGIN_ATTEMPTS.get(client_ip, {"fails": 0, "locked_until": 0.0})

            if attempt_info["locked_until"] > now:
                remaining = int(attempt_info["locked_until"] - now) + 1
                self._send_json({
                    "success": False,
                    "locked": True,
                    "retry_after": remaining,
                    "error": f"Terlalu banyak percobaan gagal. Akses dikunci sementara selama {remaining} detik."
                }, 429)
                return

            username = (body.get("username") or "").strip()
            password = body.get("password") or ""
            pin = body.get("pin", "")
            session_id = str(uuid.uuid4())
            session = StateSpaceSession(session_id)

            if username or password:
                user = verify_user_credentials(username, password)
                if user:
                    LOGIN_ATTEMPTS.pop(client_ip, None)
                    session.is_authenticated = True
                    session.current_state = "S1_TOOL_SELECTION"
                    ACTIVE_SESSIONS[session_id] = session
                    self._send_json({
                        "success": True,
                        "session_id": session_id,
                        "operator_name": user["username"],
                        "must_change_password": user["is_default_password"],
                        "message": "Login berhasil."
                    }, 200)
                    return
                else:
                    auth_ok = False
            else:
                auth_res = session.authenticate(pin)
                auth_ok = auth_res["success"]
                if auth_ok:
                    LOGIN_ATTEMPTS.pop(client_ip, None)
                    ACTIVE_SESSIONS[session_id] = session
                    auth_res["session_id"] = session_id
                    auth_res["operator_name"] = (body.get("operator_name") or "").strip() or "Andrian"
                    auth_res["must_change_password"] = False
                    self._send_json(auth_res, 200)
                    return

            if not auth_ok:
                fails = attempt_info["fails"] + 1
                if fails >= MAX_LOGIN_ATTEMPTS:
                    LOGIN_ATTEMPTS[client_ip] = {"fails": fails, "locked_until": now + LOCKOUT_SECONDS}
                    self._send_json({
                        "success": False,
                        "locked": True,
                        "retry_after": LOCKOUT_SECONDS,
                        "attempts_left": 0,
                        "error": f"Gagal masuk 3 kali berturut-turut. Tombol masuk dikunci sementara selama {LOCKOUT_SECONDS // 60} menit."
                    }, 429)
                else:
                    LOGIN_ATTEMPTS[client_ip] = {"fails": fails, "locked_until": 0.0}
                    left = MAX_LOGIN_ATTEMPTS - fails
                    self._send_json({
                        "success": False,
                        "locked": False,
                        "attempts_left": left,
                        "error": f"Username atau password salah. Sisa percobaan: {left} kali lagi."
                    }, 401)
            return

        # 1B. API: Ganti Password Wajib (Setelah Login Default)
        if path == "/api/auth/change-password":
            username = (body.get("username") or "lingling").strip()
            new_password = (body.get("new_password") or "").strip()
            if len(new_password) < 6:
                self._send_json({"error": "Password baru minimal 6 karakter."}, 400)
                return
            if new_password.lower() == "ling123":
                self._send_json({"error": "Password baru tidak boleh sama dengan password default (ling123)."}, 400)
                return

            ok = change_user_password(username, new_password)
            if ok:
                self._send_json({
                    "success": True,
                    "is_default_password": False,
                    "message": "Password baru berhasil disimpan."
                }, 200)
            else:
                self._send_json({"error": "Akun pengurus tidak ditemukan."}, 404)
            return

        # 2. API: Unggah Foto Kamera HP (Base64 -> Local File)
        if path == "/api/upload-photo":
            image_data = body.get("image_data", "")
            if not image_data:
                self._send_json({"error": "Data gambar tidak ditemukan"}, 400)
                return

            try:
                # Strip header data:image/xxx;base64,
                if "," in image_data:
                    header, encoded = image_data.split(",", 1)
                else:
                    encoded = image_data

                decoded_bytes = base64.b64decode(encoded)
                filename = f"tool_{uuid.uuid4().hex[:10]}.jpg"
                file_path = config.UPLOAD_DIR / filename
                file_path.write_bytes(decoded_bytes)

                photo_url = f"/uploads/{filename}"
                self._send_json({"success": True, "url": photo_url})
            except Exception as e:
                self._send_json({"error": f"Gagal menyimpan foto: {e}"}, 500)
            return

        # 3. API: Mulai Sesi Diagnosis / Peminjaman (S1 -> S2)
        if path == "/api/chat/start":
            session_id = body.get("session_id")
            item_id = body.get("item_id")
            borrower_name = body.get("borrower_name", "")
            borrower_phone = body.get("borrower_phone", "")
            days = int(body.get("days", 1))

            session = ACTIVE_SESSIONS.get(session_id)
            if not session or not session.is_authenticated:
                self._send_json({"error": "Sesi tidak valid atau belum terautentikasi"}, 401)
                return

            item = get_item_by_id(item_id)
            if not item:
                self._send_json({"error": "Item tidak ditemukan"}, 404)
                return

            if item["status"] == "MAINTENANCE_LOCKED":
                self._send_json({
                    "error": "Alat ini sedang dalam status LOCKOUT (Karantina Perbaikan) dan tidak boleh dipinjamkan."
                }, 400)
                return

            dur_ok, dur_err, max_days = validate_borrow_duration(item, days)
            if not dur_ok:
                self._send_json({"error": dur_err, "max_days": max_days}, 400)
                return

            session.start_assessment(item, borrower_name, borrower_phone, days)
            first_q = session.get_current_question()
            self._send_json({
                "message": f"Memulai triase keamanan untuk {item['name']}.",
                "question": first_q,
                "state": session.current_state
            })
            return

        # 4. API: Fast-Track Smart Assessment (Evaluasi 3 Langkah Cepat)
        if path == "/api/chat/quick-assess":
            session_id = body.get("session_id")
            item_id = body.get("item_id")
            borrower_name = body.get("borrower_name", "")
            borrower_phone = body.get("borrower_phone", "")
            days = int(body.get("days", 1))
            facts = body.get("facts", {})
            photo_url = body.get("photo_url", "")

            session = ACTIVE_SESSIONS.get(session_id)
            if not session or not session.is_authenticated:
                self._send_json({"error": "Sesi tidak valid atau belum terautentikasi"}, 401)
                return

            item = get_item_by_id(item_id)
            if not item:
                self._send_json({"error": "Item tidak ditemukan"}, 404)
                return

            if item["status"] == "MAINTENANCE_LOCKED":
                self._send_json({
                    "error": "Alat ini sedang dalam status LOCKOUT (Karantina Perbaikan) dan tidak boleh dipinjamkan."
                }, 400)
                return

            dur_ok, dur_err, max_days = validate_borrow_duration(item, days)
            if not dur_ok:
                self._send_json({"error": dur_err, "max_days": max_days}, 400)
                return

            result = session.submit_batch_assessment(item, borrower_name, borrower_phone, days, facts)
            # Simpan foto awal ke hasil jika ada
            if photo_url:
                result["initial_photo_url"] = photo_url
                session.final_result["initial_photo_url"] = photo_url

            self._send_json({
                "finished": True,
                "state": session.current_state,
                "result": result
            })
            return

        # 5. API: Menjawab Pertanyaan Fakta Satu Per Satu
        if path == "/api/chat/answer":
            session_id = body.get("session_id")
            cf_val = float(body.get("cf_value", 0.0))

            session = ACTIVE_SESSIONS.get(session_id)
            if not session:
                self._send_json({"error": "Sesi tidak ditemukan"}, 404)
                return

            next_data = session.answer_question(cf_val)

            if session.current_state == "G_DECISION_ACTION":
                self._send_json({
                    "finished": True,
                    "state": session.current_state,
                    "result": next_data
                })
            else:
                self._send_json({
                    "finished": False,
                    "state": session.current_state,
                    "question": next_data
                })
            return

        # 6. API: Konfirmasi Transaksi & Update Status Alat
        if path == "/api/borrow/confirm":
            session_id = body.get("session_id")
            session = ACTIVE_SESSIONS.get(session_id)
            if not session or not session.final_result:
                self._send_json({"error": "Data hasil triase tidak ditemukan"}, 400)
                return

            res = session.final_result
            item_id = res["item"]["id"]
            zone = res["heuristic_evaluation"]["zone"]
            photo_url = res.get("initial_photo_url", "")

            # Logika Triase Aset:
            if zone == "RED":
                update_item_status(item_id, "MAINTENANCE_LOCKED", photo_url)
                record_status = "REJECTED_LOCKOUT"
            else:
                update_item_status(item_id, "BORROWED", photo_url)
                record_status = "ACTIVE"

            record_data = {
                "item_id": item_id,
                "borrower_name": res["borrower"]["name"],
                "borrower_phone": res["borrower"]["phone"],
                "borrow_days": res["borrower"]["days"],
                "status": record_status,
                "decision_code": res["primary_decision"]["code"] if res["primary_decision"] else "K01",
                "decision_name": res["primary_decision"]["name"] if res["primary_decision"] else "Layak Pakai",
                "zone": zone,
                "heuristic_score": res["heuristic_evaluation"]["heuristic_score"],
                "cf_percentage": res["primary_decision"]["percentage"] if res["primary_decision"] else 95.0,
                "facts": session.facts_collected,
                "initial_photo_url": photo_url
            }

            rec_id = save_borrowing_record(record_data)
            self._send_json({
                "success": True,
                "record_id": rec_id,
                "record_status": record_status,
                "message": "Peminjaman dicatat & status inventaris berhasil diperbarui."
            })
            return

        # 6B. API: Smart Borrowing Wizard (Modal 3 Langkah Cepat & Bersih)
        if path == "/api/borrow/wizard":
            item_id = body.get("item_id")
            borrower_name = (body.get("borrower_name") or "").strip()
            borrower_phone = (body.get("borrower_phone") or "").strip()
            borrow_days = int(body.get("borrow_days") or 1)
            photo_url = body.get("photo_url", "")
            facts_input = body.get("facts", {})

            if not item_id or not borrower_name:
                self._send_json({"error": "Peralatan dan Nama Peminjam wajib diisi."}, 400)
                return

            item = get_item_by_id(int(item_id))
            if not item:
                self._send_json({"error": "Peralatan tidak ditemukan."}, 404)
                return

            dur_ok, dur_err, max_days = validate_borrow_duration(item, borrow_days)
            if not dur_ok:
                self._send_json({"error": dur_err, "max_days": max_days}, 400)
                return

            # Evaluasi Sistem Pakar AI di latar belakang
            heuristic_res = HeuristicRiskEngine.evaluate_risk(facts_input)
            inference_res = ForwardChainingEngine.infer(facts_input)

            zone = heuristic_res["zone"]
            h_score = heuristic_res["heuristic_score"]
            primary_dec = inference_res.get("primary_decision")

            decision_code = primary_dec["code"] if primary_dec else "K01"
            decision_name = primary_dec["name"] if primary_dec else "Layak Pakai Optimal"
            cf_percent = primary_dec["percentage"] if primary_dec else 95.0

            if zone == "RED":
                update_item_status(item_id, "MAINTENANCE_LOCKED", photo_url or item.get("last_photo_url", ""))
                record_status = "REJECTED_LOCKOUT"
            else:
                update_item_status(item_id, "BORROWED", photo_url or item.get("last_photo_url", ""))
                record_status = "ACTIVE"

            record_data = {
                "item_id": item_id,
                "borrower_name": borrower_name,
                "borrower_phone": borrower_phone,
                "borrow_days": borrow_days,
                "status": record_status,
                "decision_code": decision_code,
                "decision_name": decision_name,
                "zone": zone,
                "heuristic_score": h_score,
                "cf_percentage": cf_percent,
                "facts": facts_input,
                "initial_photo_url": photo_url or item.get("last_photo_url", "")
            }

            rec_id = save_borrowing_record(record_data)

            # Buat teks WhatsApp otomatis ramah warga
            clean_phone = "".join(filter(str.isdigit, borrower_phone))
            if clean_phone.startswith("0"):
                clean_phone = "62" + clean_phone[1:]

            wa_msg = f"Halo *{borrower_name}*,\n"
            wa_msg += f"Peminjaman alat *{item['name']}* selama *{borrow_days} hari* sudah dicatat di GudangLingling.\n\n"
            wa_msg += f"Status kondisi: *{decision_name}* ({heuristic_res.get('zone_label', zone)}, skor risiko {h_score}/100).\n"
            wa_msg += f"Catatan pemakaian: {heuristic_res.get('safety_advice', 'Alat aman digunakan.')}\n\n"
            wa_msg += f"Mohon dijaga baik-baik dan dikembalikan tepat waktu ya. Terima kasih!"

            encoded_wa = quote(wa_msg)
            wa_url = f"https://wa.me/{clean_phone}?text={encoded_wa}" if clean_phone else f"https://wa.me/?text={encoded_wa}"

            self._send_json({
                "success": True,
                "record_id": rec_id,
                "item": item,
                "zone": zone,
                "zone_label": heuristic_res.get("zone_label", zone),
                "heuristic_score": h_score,
                "decision_name": decision_name,
                "cf_percentage": cf_percent,
                "safety_advice": heuristic_res.get("safety_advice", ""),
                "record_status": record_status,
                "whatsapp_url": wa_url,
                "whatsapp_text": wa_msg
            })
            return

        # 7. API: Selesaikan Pengembalian dengan Cek Foto Kamera HP (Return Check - Wajib Foto)
        if path == "/api/borrow/return-check":
            record_id = body.get("record_id")
            return_photo_url = (body.get("return_photo_url") or "").strip()
            if not record_id:
                self._send_json({"error": "record_id diperlukan"}, 400)
                return
            if not return_photo_url:
                self._send_json({"error": "Foto kondisi akhir alat wajib diunggah sebelum menyelesaikan pengembalian."}, 400)
                return

            success = complete_return_check(int(record_id), return_photo_url)
            if success:
                self._send_json({
                    "success": True,
                    "message": "Pengembalian selesai diverifikasi. Foto kondisi akhir berhasil disimpan."
                })
            else:
                self._send_json({"error": "Gagal memproses pengembalian."}, 500)
            return

        # 7B. API: Catat Log Arsip Bukti Digital Permanen saat Kirim WhatsApp
        if path == "/api/archive-receipt":
            record_id = body.get("record_id")
            item_name = (body.get("item_name") or "Peralatan").strip()
            borrower_name = (body.get("borrower_name") or "Warga").strip()
            borrow_days = int(body.get("borrow_days") or 1)
            log_email_archive(
                record_id=int(record_id) if record_id else None,
                recipient="arsip-keluarga@gudanglingling.internal",
                subject=f"Pesan WA konfirmasi peminjaman {item_name} ({borrow_days} hari) dikirim ke {borrower_name}.",
                status="Bukti Disimpan"
            )
            self._send_json({"success": True, "message": "Bukti serah terima tercatat permanen di log arsip."})
            return

        # 8. API: Buka Kunci Alat Selesai Diservis (Unlock Maintenance)
        if path == "/api/items/unlock":
            item_id = body.get("item_id")
            if not item_id:
                self._send_json({"error": "item_id diperlukan"}, 400)
                return
            success = unlock_maintenance_item(int(item_id))
            self._send_json({"success": success, "message": "Alat telah diverifikasi selesai diservis dan kembali tersedia."})
            return

        # 9. API: Tambah Alat Baru ke Inventaris (Manual Input)
        if path == "/api/items" or path == "/api/items/create":
            name = body.get("name", "").strip()
            if not name:
                self._send_json({"error": "Nama alat wajib diisi"}, 400)
                return
            item_id = add_item(body)
            self._send_json({"success": True, "item_id": item_id, "message": "Alat berhasil ditambahkan ke inventaris."})
            return

        # 10. API: Hapus Alat dari Inventaris
        if path == "/api/items/delete":
            item_id = body.get("item_id")
            if not item_id:
                self._send_json({"error": "item_id diperlukan"}, 400)
                return
            success = delete_item(int(item_id))
            self._send_json({"success": success, "message": "Alat berhasil dihapus dari inventaris."})
            return

        self.send_error(404, "Endpoint POST tidak ditemukan")


def run_server():
    # Inisialisasi skema database kosong (clean install — tanpa data dummy)
    seed_database()

    server_address = (config.HOST, config.PORT)
    httpd = ReusableThreadingServer(server_address, GudangLinglingRequestHandler)
    print("=" * 65)
    print(" GUDANGLINGLING AI — Intelligent Household Asset Lending Chatbot")
    print(" Pengembang: Liana Sry Astuti (NIM: 2422031)")
    print(" Dosen Pengampu: Bapak Deosa Putra Caniago, M.Kom")
    print(f" Server berjalan di: http://{config.HOST}:{config.PORT}")
    print(f" PIN Default Akses Keluarga: {config.DEFAULT_FAMILY_PIN}")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Mematikan server...")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
