import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse
from calculator import Calculator

PORT = 3000
calc = Calculator()


class CalculatorRequestHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        """Définit les en-têtes CORS nécessaires pour le Front-end."""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers", "Content-Type, Authorization"
        )

    def do_OPTIONS(self):
        """Gère le preflight CORS (équivalent de req.method === 'OPTIONS')."""
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        """Gère toutes les requêtes GET (Front-end et API)."""
        # Analyse de l'URL
        parsed_url = urlparse(self.path)
        pathname = parsed_url.path

        # 1. ROUTE : Racine "/" ou "/index.html" -> Servir le Front-end
        if pathname in ["/", "/index.html"]:
            # Construction du chemin absolu vers public/index.html
            current_dir = os.path.dirname(os.path.abspath(__file__))
            file_path = os.path.abspath(
                os.path.join(current_dir, "..", "public", "index.html")
            )

            if not os.path.exists(file_path):
                self._send_json_response(
                    500, {"error": "Erreur interne du serveur."}
                )
                return

            try:
                with open(file_path, "r", encoding="utf-8") as file:
                    content = file.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(content.encode("utf-8"))
            except Exception:
                self._send_json_response(
                    500, {"error": "Erreur interne du serveur."}
                )
            return

        # 2. ROUTE : "/calculate" -> Traitement de l'API
        if pathname == "/calculate":
            query_params = parse_qs(parsed_url.query)

            # parse_qs retourne des listes pour chaque clé. On extrait le premier élément.
            operation = query_params.get("operation", [None])[0]
            a_raw = query_params.get("a", [None])[0]
            b_raw = query_params.get("b", [None])[0]

            # Validation : Paramètres manquants
            if not operation or a_raw is None or b_raw is None:
                self._send_json_response(
                    400, {"error": "Paramètres attendus : operation, a, b"}
                )
                return

            # Validation : Types numériques
            try:
                num_a = float(a_raw)
                num_b = float(b_raw)
            except ValueError:
                self._send_json_response(
                    400,
                    {
                        "error": "Les paramètres a et b doivent être des nombres."
                    },
                )
                return

            # Validation : Opération inconnue
            if operation not in ["add", "subtract", "multiply", "divide"]:
                self._send_json_response(
                    400,
                    {
                        "error": "Opération inconnue. Utiliser : add, subtract, multiply, divide"
                    },
                )
                return

            # Exécution du calcul
            try:
                result = 0.0
                if operation == "add":
                    result = calc.add(num_a, num_b)
                elif operation == "subtract":
                    result = calc.subtract(num_a, num_b)
                elif operation == "multiply":
                    result = calc.multiply(num_a, num_b)
                elif operation == "divide":
                    result = calc.divide(num_a, num_b)

                # Si le résultat est un entier rond (ex: 5.0), on peut l'afficher proprement
                if result.is_integer():
                    result = int(result)

                response_body = {
                    "operation": operation,
                    "a": int(num_a) if num_a.is_integer() else num_a,
                    "b": int(num_b) if num_b.is_integer() else num_b,
                    "result": result,
                }
                self._send_json_response(200, response_body)

            except ValueError as e:
                self._send_json_response(400, {"error": str(e)})
            return

        # 3. ROUTE INCONNUE (404)
        self._send_json_response(404, {"error": "Route introuvable."})

    def do_POST(self):
        """Gère les requêtes POST (renvoie 405 Méthode non autorisée)."""
        self._send_method_not_allowed()

    def do_PUT(self):
        """Gère les requêtes PUT (renvoie 405 Méthode non autorisée)."""
        self._send_method_not_allowed()

    def _send_json_response(self, status_code: int, data: dict):
        """Helper pour formater et envoyer une réponse JSON propre."""
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def _send_method_not_allowed(self):
        """Helper standard pour renvoyer une erreur 405."""
        self.send_response(405)
        self.send_header("Allow", "GET, OPTIONS")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(
            json.dumps(
                {"error": "Méthode non autorisée. Utiliser GET."}
            ).encode("utf-8")
        )


def start_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, CalculatorRequestHandler)
    httpd.serve_forever()


if __name__ == "__main__":
    print(f"Serveur démarré sur http://localhost:{PORT}")
    try:
        start_server()
    except KeyboardInterrupt:
        print("\nServeur arrêté.")