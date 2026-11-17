"""
Integration Test untuk Endpoint REST API GudangLingling AI
"""

import sys
import json
import time
import threading
from pathlib import Path
import unittest
from urllib import request

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app import GudangLinglingRequestHandler
from http.server import ThreadingHTTPServer
from database.seed import seed_database_for_development
import config

TEST_PORT = 8089
TEST_DB = BASE_DIR / "database" / "test_gudanglingling.db"


class TestAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        config.DB_PATH = TEST_DB
        seed_database_for_development()
        cls.server = ThreadingHTTPServer(("127.0.0.1", TEST_PORT), GudangLinglingRequestHandler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        if TEST_DB.exists():
            try:
                TEST_DB.unlink()
            except Exception:
                pass

    def test_01_health_endpoint(self):
        url = f"http://127.0.0.1:{TEST_PORT}/api/health"
        req = request.urlopen(url)
        self.assertEqual(req.status, 200)
        data = json.loads(req.read().decode("utf-8"))
        self.assertEqual(data["academic"]["mahasiswa"], "Liana Sry Astuti")
        self.assertEqual(data["academic"]["nim"], "2422031")

    def test_02_items_endpoint(self):
        url = f"http://127.0.0.1:{TEST_PORT}/api/items"
        req = request.urlopen(url)
        self.assertEqual(req.status, 200)
        data = json.loads(req.read().decode("utf-8"))
        self.assertIn("items", data)
        self.assertGreater(len(data["items"]), 0)

    def test_03_auth_and_chat_flow(self):
        # 1. Test Auth PIN
        auth_url = f"http://127.0.0.1:{TEST_PORT}/api/auth"
        body = json.dumps({"pin": config.DEFAULT_FAMILY_PIN}).encode("utf-8")
        req = request.Request(auth_url, data=body, headers={"Content-Type": "application/json"})
        resp = request.urlopen(req)
        auth_data = json.loads(resp.read().decode("utf-8"))
        self.assertTrue(auth_data["success"])
        session_id = auth_data["session_id"]

        # 2. Start Assessment
        start_url = f"http://127.0.0.1:{TEST_PORT}/api/chat/start"
        start_body = json.dumps({
            "session_id": session_id,
            "item_id": 1,
            "borrower_name": "Rudi Hartono",
            "borrower_phone": "08123456789",
            "days": 2
        }).encode("utf-8")
        req2 = request.Request(start_url, data=start_body, headers={"Content-Type": "application/json"})
        resp2 = request.urlopen(req2)
        start_data = json.loads(resp2.read().decode("utf-8"))
        self.assertIn("question", start_data)

        # 3. Answer First Question with F01 = 0.8 (Kabel Terkelupas)
        ans_url = f"http://127.0.0.1:{TEST_PORT}/api/chat/answer"
        ans_body = json.dumps({
            "session_id": session_id,
            "cf_value": 0.8
        }).encode("utf-8")
        req3 = request.Request(ans_url, data=ans_body, headers={"Content-Type": "application/json"})
        resp3 = request.urlopen(req3)
        ans_data = json.loads(resp3.read().decode("utf-8"))
        self.assertFalse(ans_data["finished"])

    def test_04_knowledge_base_inspection(self):
        url = f"http://127.0.0.1:{TEST_PORT}/api/knowledge-base"
        req = request.urlopen(url)
        self.assertEqual(req.status, 200)
        data = json.loads(req.read().decode("utf-8"))
        self.assertEqual(len(data["decisions"]), 5)
        self.assertEqual(len(data["facts"]), 20)
        self.assertEqual(len(data["rules"]), 15)

    def test_05_borrow_wizard_endpoint(self):
        from urllib.error import HTTPError
        url = f"http://127.0.0.1:{TEST_PORT}/api/borrow/wizard"
        payload = json.dumps({
            "item_id": 1,
            "borrower_name": "Pak Budi",
            "borrower_phone": "08123456789",
            "borrow_days": 1,
            "facts": {}
        }).encode("utf-8")

        # 1. Tanpa token sesi harus ditolak 401
        req_unauth = request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with self.assertRaises(HTTPError) as ctx:
            request.urlopen(req_unauth)
        self.assertEqual(ctx.exception.code, 401)

        # 2. Login dulu untuk mendapatkan auth_token
        auth_req = request.Request(
            f"http://127.0.0.1:{TEST_PORT}/api/auth",
            data=json.dumps({"pin": "1234"}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        auth_data = json.loads(request.urlopen(auth_req).read().decode("utf-8"))
        token = auth_data["auth_token"]

        # 3. Pinjam dengan token valid -> 200
        req = request.Request(url, data=payload, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
        resp = request.urlopen(req)
        self.assertEqual(resp.status, 200)
        data = json.loads(resp.read().decode("utf-8"))
        self.assertTrue(data["success"])
        self.assertEqual(data["zone"], "GREEN")
        self.assertIn("whatsapp_url", data)

        # 4. Pinjam ulang barang yang statusnya BORROWED -> 409 Conflict
        req_dup = request.Request(url, data=payload, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
        with self.assertRaises(HTTPError) as ctx2:
            request.urlopen(req_dup)
        self.assertEqual(ctx2.exception.code, 409)


if __name__ == "__main__":
    unittest.main()
