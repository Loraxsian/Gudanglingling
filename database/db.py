"""
Lapisan Database SQLite untuk GudangLingling AI
Mengelola Data Inventaris Alat, Foto Bukti Kondisi, Transaksi Peminjaman, Log Email, dan Status Lockout.
"""

import sqlite3
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from config import DB_PATH


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Membuat tabel dan migrasi skema jika belum ada."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # 1. Tabel Inventaris Peralatan Rumah Tangga
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            power_watts INTEGER DEFAULT 0,
            status TEXT DEFAULT 'AVAILABLE',  -- 'AVAILABLE', 'BORROWED', 'MAINTENANCE_LOCKED'
            description TEXT,
            danger_level TEXT DEFAULT 'SEDANG',
            last_photo_url TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Cek kolom last_photo_url jika migrasi dari versi lama
        cursor.execute("PRAGMA table_info(items)")
        columns = [col[1] for col in cursor.fetchall()]
        if "last_photo_url" not in columns:
            cursor.execute("ALTER TABLE items ADD COLUMN last_photo_url TEXT DEFAULT ''")

        # 2. Tabel Riwayat Peminjaman & Hasil Triase AI
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS borrowing_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            borrower_name TEXT NOT NULL,
            borrower_phone TEXT,
            borrow_days INTEGER DEFAULT 1,
            status TEXT DEFAULT 'ACTIVE',  -- 'ACTIVE', 'RETURNED', 'REJECTED_LOCKOUT'
            decision_code TEXT,
            decision_name TEXT,
            zone TEXT,
            heuristic_score REAL,
            cf_percentage REAL,
            facts_json TEXT,
            initial_photo_url TEXT DEFAULT '',
            return_photo_url TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            returned_at TIMESTAMP,
            FOREIGN KEY(item_id) REFERENCES items(id)
        );
        """)

        cursor.execute("PRAGMA table_info(borrowing_records)")
        b_cols = [col[1] for col in cursor.fetchall()]
        if "initial_photo_url" not in b_cols:
            cursor.execute("ALTER TABLE borrowing_records ADD COLUMN initial_photo_url TEXT DEFAULT ''")
        if "return_photo_url" not in b_cols:
            cursor.execute("ALTER TABLE borrowing_records ADD COLUMN return_photo_url TEXT DEFAULT ''")
        if "returned_at" not in b_cols:
            cursor.execute("ALTER TABLE borrowing_records ADD COLUMN returned_at TIMESTAMP")

        # 3. Tabel Log Arsip Email (Email Backup Log)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS email_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER,
            recipient TEXT NOT NULL,
            subject TEXT NOT NULL,
            status TEXT DEFAULT 'ARCHIVED',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(record_id) REFERENCES borrowing_records(id)
        );
        """)

        conn.commit()


def get_all_items() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT 
            i.*,
            active_b.borrower_name as active_borrower,
            active_b.borrow_days as active_borrow_days,
            active_b.id as active_record_id,
            last_b.borrower_name as last_borrower,
            last_b.returned_at as last_returned_at
        FROM items i
        LEFT JOIN (
            SELECT item_id, id, borrower_name, borrow_days 
            FROM borrowing_records 
            WHERE status = 'ACTIVE' 
            GROUP BY item_id
        ) active_b ON i.id = active_b.item_id
        LEFT JOIN (
            SELECT b1.item_id, b1.borrower_name, b1.returned_at
            FROM borrowing_records b1
            INNER JOIN (
                SELECT item_id, MAX(id) as max_id
                FROM borrowing_records
                WHERE status = 'RETURNED'
                GROUP BY item_id
            ) b2 ON b1.id = b2.max_id
        ) last_b ON i.id = last_b.item_id
        ORDER BY i.id ASC
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_item_by_id(item_id: int) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM items WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        if not row:
            return None
        item = dict(row)
        cursor.execute("""
        SELECT id, borrower_name, borrower_phone, borrow_days, status, decision_name, zone, heuristic_score, cf_percentage, created_at, returned_at
        FROM borrowing_records
        WHERE item_id = ?
        ORDER BY id DESC
        LIMIT 5
        """, (item_id,))
        item["records"] = [dict(r) for r in cursor.fetchall()]
        return item


def update_item_status(item_id: int, status: str, last_photo_url: Optional[str] = None) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        if last_photo_url:
            cursor.execute("UPDATE items SET status = ?, last_photo_url = ? WHERE id = ?", (status, last_photo_url, item_id))
        else:
            cursor.execute("UPDATE items SET status = ? WHERE id = ?", (status, item_id))
        conn.commit()
        return cursor.rowcount > 0


def save_borrowing_record(data: Dict[str, Any]) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO borrowing_records (
            item_id, borrower_name, borrower_phone, borrow_days,
            status, decision_code, decision_name, zone,
            heuristic_score, cf_percentage, facts_json, initial_photo_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("item_id"),
            data.get("borrower_name"),
            data.get("borrower_phone", ""),
            data.get("borrow_days", 1),
            data.get("status", "ACTIVE"),
            data.get("decision_code", ""),
            data.get("decision_name", ""),
            data.get("zone", "GREEN"),
            data.get("heuristic_score", 0.0),
            data.get("cf_percentage", 0.0),
            json.dumps(data.get("facts", {})),
            data.get("initial_photo_url", "")
        ))
        record_id = cursor.lastrowid
        conn.commit()

        # Otomatis catat log arsip email cadangan
        log_email_archive(
            record_id=record_id,
            recipient="arsip-keluarga@gudanglingling.internal",
            subject=f"Bukti Peminjaman: {data.get('decision_name')} - {data.get('borrower_name')}",
            status="TERKIRIM (Arsip Digital)"
        )
        return record_id


def complete_return_check(record_id: int, return_photo_url: str) -> bool:
    """Menyelesaikan pengembalian dengan perbandingan foto kondisi akhir."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT item_id, borrower_name FROM borrowing_records WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        if not row:
            return False

        item_id = row["item_id"]
        cursor.execute("""
        UPDATE borrowing_records
        SET status = 'RETURNED', return_photo_url = ?, returned_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """, (return_photo_url, record_id))

        cursor.execute("UPDATE items SET status = 'AVAILABLE', last_photo_url = ? WHERE id = ?", (return_photo_url, item_id))
        conn.commit()

        # Catat email log pengembalian
        log_email_archive(
            record_id=record_id,
            recipient="arsip-keluarga@gudanglingling.internal",
            subject=f"Pengembalian Selesai: Item #{item_id} oleh {row['borrower_name']}",
            status="TERKIRIM (Pengembalian Diverifikasi)"
        )
        return True


def get_borrowing_record_by_id(record_id: int) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT b.*, i.name as item_name, i.category as item_category
        FROM borrowing_records b
        LEFT JOIN items i ON b.item_id = i.id
        WHERE b.id = ?
        """, (record_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_reminder_queue() -> List[Dict[str, Any]]:
    """Mengambil antrean peminjaman aktif yang diurutkan untuk pengingat tenggat waktu."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT b.*, i.name as item_name, i.category as item_category,
               CAST((julianday('now') - julianday(b.created_at)) AS INTEGER) as days_elapsed
        FROM borrowing_records b
        LEFT JOIN items i ON b.item_id = i.id
        WHERE b.status = 'ACTIVE'
        ORDER BY b.created_at ASC
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_borrowing_history() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT b.*, i.name as item_name, i.category as item_category
        FROM borrowing_records b
        LEFT JOIN items i ON b.item_id = i.id
        ORDER BY b.id DESC
        LIMIT 50
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def log_email_archive(record_id: int, recipient: str, subject: str, status: str = "TERKIRIM"):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO email_logs (record_id, recipient, subject, status)
        VALUES (?, ?, ?, ?)
        """, (record_id, recipient, subject, status))
        conn.commit()


def get_email_logs() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT e.*, b.borrower_name, b.borrower_phone
        FROM email_logs e
        LEFT JOIN borrowing_records b ON e.record_id = b.id
        ORDER BY e.id DESC
        LIMIT 30
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def unlock_maintenance_item(item_id: int) -> bool:
    """Mengembalikan status alat yang di-lockout ke kondisi 'AVAILABLE' setelah diperbaiki."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE items SET status = 'AVAILABLE' WHERE id = ?", (item_id,))
        conn.commit()
        return cursor.rowcount > 0
