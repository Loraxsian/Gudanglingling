"""
GudangLingling AI — Script Runner Terpadu
Menjalankan semua test + server dengan satu perintah sederhana.

Penggunaan:
  python3 run.py              → Jalankan server web (default)
  python3 run.py test         → Jalankan seluruh test suite
  python3 run.py simulate     → Jalankan laporan simulasi kasus uji akademik
  python3 run.py seed         → Reset & isi ulang database dengan data awal
"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


def cmd_server():
    from app import run_server
    run_server()


def cmd_test():
    import unittest
    from tests.test_engine import TestAIEngine
    from tests.test_api import TestAPIEndpoints

    print("=" * 60)
    print("  GUDANGLINGLING AI — FULL TEST SUITE")
    print("=" * 60)
    print("\n[1/2] Menjalankan Unit Tests Mesin AI (6 test cases)...")
    suite1 = unittest.TestLoader().loadTestsFromTestCase(TestAIEngine)
    result1 = unittest.TextTestRunner(verbosity=2).run(suite1)

    print("\n[2/2] Menjalankan Integration Tests REST API (4 test cases)...")
    suite2 = unittest.TestLoader().loadTestsFromTestCase(TestAPIEndpoints)
    result2 = unittest.TextTestRunner(verbosity=2).run(suite2)

    total = result1.testsRun + result2.testsRun
    errors = len(result1.errors + result2.errors + result1.failures + result2.failures)
    print(f"\n{'=' * 60}")
    print(f"  Total: {total} test | Lulus: {total - errors} | Gagal: {errors}")
    print("=" * 60)
    sys.exit(0 if errors == 0 else 1)


def cmd_simulate():
    from tests.test_simulation import run_all
    run_all()


def cmd_seed():
    from database.seed import seed_database
    # Drop existing items table first so it re-seeds
    from database.db import get_connection
    with get_connection() as conn:
        conn.execute("DELETE FROM items")
        conn.execute("DELETE FROM borrowing_records")
        conn.commit()
    seed_database()
    print("[Seed] Database berhasil direset dan diisi ulang.")


def print_usage():
    print(__doc__)


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "server"

    dispatch = {
        "server": cmd_server,
        "test": cmd_test,
        "simulate": cmd_simulate,
        "seed": cmd_seed,
        "help": print_usage,
        "--help": print_usage,
        "-h": print_usage,
    }

    fn = dispatch.get(arg)
    if fn:
        fn()
    else:
        print(f"Perintah tidak dikenal: '{arg}'")
        print_usage()
        sys.exit(1)
