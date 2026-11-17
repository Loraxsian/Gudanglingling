"""
Database Initializer — GudangLingling AI
Menginisialisasi skema database kosong (clean install).
Inventaris diisi sendiri oleh pengguna melalui antarmuka aplikasi.

Pengembang: Liana Sry Astuti (NIM: 2422031) - ITEBA
"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from database.db import get_connection, init_db


# ---------------------------------------------------------------------------
# Data referensi (hanya untuk dokumentasi dan testing mandiri pengembang).
# TIDAK dijalankan secara otomatis saat instalasi / startup aplikasi.
# ---------------------------------------------------------------------------
SAMPLE_ITEMS_REFERENCE = [
    {
        "name": "Mesin Gerinda Tangan 4 Inch (540W)",
        "category": "Pertukangan Listrik",
        "power_watts": 540,
        "status": "AVAILABLE",
        "description": "Kecepatan 11.000 RPM. Berisiko tinggi serpihan batu gerinda dan sengatan listrik.",
        "danger_level": "SANGAT TINGGI",
        "last_photo_url": "/img/gerinda.svg"
    },
    {
        "name": "Bor Listrik Impact Drill (600W)",
        "category": "Pertukangan Listrik",
        "power_watts": 600,
        "status": "AVAILABLE",
        "description": "Bor tembok beton & besi. Memiliki fitur impact hammer dan torsi tinggi.",
        "danger_level": "TINGGI",
        "last_photo_url": "/img/bor.svg"
    },
    {
        "name": "Mesin Potong Rumput Listrik / Senar",
        "category": "Perkebunan",
        "power_watts": 450,
        "status": "AVAILABLE",
        "description": "Pemotong rumput halaman. Berbahaya jika digunakan di rumput basah berair.",
        "danger_level": "TINGGI",
        "last_photo_url": "/img/rumput.svg"
    },
    {
        "name": "Tangga Lipat Aluminium Teleskopik (3.8 Meter)",
        "category": "Akses Ketinggian",
        "power_watts": 0,
        "status": "AVAILABLE",
        "description": "Tangga lipat 12 anak tangga. Wajib dipastikan engsel dan karet pijakan mengunci rapat.",
        "danger_level": "TINGGI",
        "last_photo_url": "/img/tangga.svg"
    },
    {
        "name": "Gergaji Mesin Kayu Jigsaw Listrik",
        "category": "Pertukangan Listrik",
        "power_watts": 400,
        "status": "AVAILABLE",
        "description": "Pemotong triplek dan papan kayu dengan osilasi bilah pisau vertikal.",
        "danger_level": "SEDANG",
        "last_photo_url": "/img/jigsaw.svg"
    },
    {
        "name": "High-Pressure Jet Cleaner Cuci Mobil (850W)",
        "category": "Peralatan Air & Cuci",
        "power_watts": 850,
        "status": "AVAILABLE",
        "description": "Semprotan air bertekanan 100 bar dengan motor induksi listrik berdaya tinggi.",
        "danger_level": "TINGGI",
        "last_photo_url": "/img/jetcleaner.svg"
    },
    {
        "name": "Obeng Portabel Baterai Cordless (3.6V)",
        "category": "Pertukangan Ringan",
        "power_watts": 15,
        "status": "AVAILABLE",
        "description": "Alat alternatif ramah pemula untuk pemasangan sekrup, engsel, atau perabot knock-down.",
        "danger_level": "RENDAH",
        "last_photo_url": "/img/obeng.svg"
    },
    {
        "name": "Kotak Kunci Pas & Perkakas Manual (53 Pcs)",
        "category": "Perkakas Manual",
        "power_watts": 0,
        "status": "AVAILABLE",
        "description": "Kunci sok, obeng manual, tang kombinasi, dan palu tanpa daya listrik.",
        "danger_level": "RENDAH",
        "last_photo_url": "/img/toolset.svg"
    }
]


def seed_database():
    """
    Dipanggil saat startup aplikasi — HANYA membuat skema tabel jika belum ada.
    Tidak mengisi data dummy apapun. Database baru selalu dimulai kosong/bersih.
    """
    init_db()
    print("[DB] Skema database siap. Inventaris kosong, menunggu data dari pengguna.")


def seed_database_for_development():
    """
    KHUSUS PENGEMBANG: mengisi database dengan 8 item contoh untuk testing.
    Jalankan manual: python3 database/seed.py --dev
    """
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM items")
        count = cursor.fetchone()["count"]

        if count == 0:
            for item in SAMPLE_ITEMS_REFERENCE:
                cursor.execute("""
                INSERT INTO items (name, category, power_watts, status, description, danger_level, last_photo_url)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    item["name"], item["category"], item["power_watts"],
                    item["status"], item["description"], item["danger_level"],
                    item["last_photo_url"]
                ))
            conn.commit()
            print(f"[Dev Seed] {len(SAMPLE_ITEMS_REFERENCE)} item contoh berhasil ditambahkan.")
        else:
            print(f"[Dev Seed] Database sudah ada data ({count} item). Seed dilewati.")


if __name__ == "__main__":
    if "--dev" in sys.argv:
        seed_database_for_development()
    else:
        seed_database()
