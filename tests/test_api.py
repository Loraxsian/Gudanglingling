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
from config import DEFAULT_FAMILY_PIN

TEST_PORT = 8089


class TestAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        seed_database_for_development()
        cls.server = ThreadingHTTPServer(("127.0.0.1", TEST_PORT), GudangLinglingRequestHandler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

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
        body = json.dumps({"pin": DEFAULT_FAMILY_PIN}).encode("utf-8")
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


if __name__ == "__main__":
    unittest.main()
