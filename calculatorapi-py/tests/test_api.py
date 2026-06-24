import json
import os
import socket
import threading
import time
import sys
import unittest
import urllib.error
import urllib.request
from http.server import HTTPServer
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_PATH = os.path.abspath(os.path.join(CURRENT_DIR, "..", "src"))
if SRC_PATH not in sys.path:
    sys.path.insert(0, SRC_PATH)

# Maintenant, les imports vont passer crème sans conflit de package
from calculator import Calculator
from server import CalculatorRequestHandler
from calculator import Calculator
from src.server import CalculatorRequestHandler, start_server


class TestCalculatorAPI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Démarre le serveur HTTP dans un thread séparé sur un port éphémère (aléatoire libre)."""
        # Trouver un port libre dynamiquement
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            cls.port = s.getsockname()[1]

        cls.base_url = f"http://127.0.0.1:{cls.port}"
        cls.server = HTTPServer(("127.0.0.1", cls.port), CalculatorRequestHandler)
        
        # Lancement du serveur dans un thread d'arrière-plan (daemonic pour qu'il coupe à la fin des tests)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        
        # Laisser un très court instant au serveur pour s'initialiser
        time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        """Arrête proprement le serveur après l'exécution de tous les tests."""
        cls.server.shutdown()
        cls.server.server_close()
        cls.server_thread.join()

    def _request(self, path, method="GET"):
        """Helper pour simuler l'utilitaire 'request' des tests JS."""
        url = f"{self.base_url}{path}"
        req = urllib.request.Request(url, method=method)
        start_time = time.time()
        
        try:
            with urllib.request.urlopen(req) as response:
                status = response.status
                headers = dict(response.headers)
                body_raw = response.read().decode("utf-8")
                
                # Essayer de parser en JSON si applicable
                try:
                    body = json.loads(body_raw)
                except json.JSONDecodeError:
                    body = body_raw
                    
                return status, body, headers, (time.time() - start_time) * 1000
        except urllib.error.HTTPError as e:
            # En Python, urllib lève une exception pour les statuts d'erreur (400, 404, 405, etc.)
            status = e.code
            headers = dict(e.headers)
            body_raw = e.read().decode("utf-8")
            try:
                body = json.loads(body_raw)
            except json.JSONDecodeError:
                body = body_raw
            return status, body, headers, (time.time() - start_time) * 1000

    # --- PERFORMANCE ---
    def test_performance_valid_request(self):
        status, _, _, duration = self._request("/calculate?operation=add&a=1&b=2")
        self.assertEqual(status, 200)
        self.assertLess(duration, 100)  # Répond en moins de 100ms

    # --- HEADERS & CORS ---
    def test_headers_success(self):
        status, _, headers, _ = self._request("/calculate?operation=add&a=1&b=2")
        self.assertEqual(status, 200)
        self.assertIn("application/json", headers.get("Content-Type", ""))
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "*")

    def test_options_preflight(self):
        status, body, headers, _ = self._request("/calculate", method="OPTIONS")
        self.assertEqual(status, 204)
        self.assertEqual(body, "")
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "*")
        self.assertIn("GET", headers.get("Access-Control-Allow-Methods", ""))

    # --- CAS NOMINAUX (Équivalent de it.each en JS) ---
    def test_nominal_cases(self):
        cases = [
            ("add", "2", "3", 5),
            ("subtract", "10", "4", 6),
            ("multiply", "6", "7", 42),
            ("divide", "20", "5", 4),
            ("add", "-5", "-3", -8),
            ("subtract", "-5", "-3", -2),
            ("multiply", "-3", "-4", 12),
            ("divide", "-10", "-2", 5),
        ]
        for op, a, b, expected in cases:
            with self.subTest(op=op, a=a, b=b):
                status, body, _, _ = self._request(f"/calculate?operation={op}&a={a}&b={b}")
                self.assertEqual(status, 200)
                self.assertEqual(body["result"], expected)

    def test_decimal_division(self):
        _, body, _, _ = self._request("/calculate?operation=divide&a=10&b=3")
        self.assertAlmostEqual(body["result"], 3.333333333)

    # --- MÉTHODES NON AUTORISÉES (405) ---
    def test_post_returns_405(self):
        status, body, headers, _ = self._request("/calculate", method="POST")
        self.assertEqual(status, 405)
        self.assertEqual(body["error"], "Méthode non autorisée. Utiliser GET.")
        self.assertIn("GET, OPTIONS", headers.get("Allow", ""))

    def test_put_returns_405(self):
        status, _, _, _ = self._request("/calculate", method="PUT")
        self.assertEqual(status, 405)

    # --- ERREURS PARAMÈTRES (400) ---
    def test_missing_parameter(self):
        status, body, _, _ = self._request("/calculate?operation=add&a=2")
        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "Paramètres attendus : operation, a, b")

    def test_non_numeric_parameter(self):
        status, body, _, _ = self._request("/calculate?operation=add&a=abc&b=3")
        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "Les paramètres a et b doivent être des nombres.")

    def test_divide_by_zero(self):
        status, body, _, _ = self._request("/calculate?operation=divide&a=10&b=0")
        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "Division par zéro impossible.")

    def test_unknown_operation(self):
        status, body, _, _ = self._request("/calculate?operation=modulo&a=10&b=3")
        self.assertEqual(status, 400)
        self.assertIn("Opération inconnue", body["error"])

    # --- AUTRES ROUTES ---
    def test_unknown_route_returns_404(self):
        status, body, _, _ = self._request("/unknown")
        self.assertEqual(status, 404)
        self.assertEqual(body["error"], "Route introuvable.")

    def test_root_returns_html(self):
        status, body, headers, _ = self._request("/")
        self.assertEqual(status, 200)
        self.assertIn("text/html", headers.get("Content-Type", ""))
        self.assertIn("<!DOCTYPE html>", body)


if __name__ == "__main__":
    unittest.main()