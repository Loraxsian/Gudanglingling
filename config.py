"""
Konfigurasi Proyek GudangLingling AI
Pengembang: Liana Sry Astuti (NIM: 2422031)
Program Studi: Teknik Komputer - Institut Teknologi Batam (ITEBA)
Mata Kuliah: Artificial Intelligence
Dosen Pengampu: Bapak Deosa Putra Caniago, M.Kom (NIDN. 1003129101)
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "database" / "gudanglingling.db"
UPLOAD_DIR = BASE_DIR / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Default Security PIN for Family/Admin Access
DEFAULT_FAMILY_PIN = "1234"
SECONDARY_FAMILY_PIN = "2422031"  # NIM Pengembang (Liana Sry Astuti) sebagai PIN alternatif

# Server settings
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", 8085))

# Heuristic Risk Evaluation Thresholds (Modul 4.5)
THRESHOLD_GREEN_MAX = 29.99
THRESHOLD_YELLOW_MAX = 69.99
THRESHOLD_RED_MIN = 70.00
