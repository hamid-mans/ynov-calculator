const http = require("http");
const { requestHandler, startServer, server: mainServer } = require("../src/server");
const { request } = require("./helpers/http");

describe("API /calculate", () => {
  let server;

  beforeAll((done) => {
    server = http.createServer(requestHandler);
    server.listen(0, "127.0.0.1", done);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe("Démarrage du serveur", () => {
    it("devrait exécuter startServer sans erreur", () => {
      const listenSpy = jest.spyOn(mainServer, "listen").mockImplementation(() => mainServer);
      
      startServer();
      
      expect(listenSpy).toHaveBeenCalled();
      listenSpy.mockRestore();
    });
  });

  describe("Performance", () => {
    it("Une requête valide répond en moins de 100 ms", async () => {
      const { duration } = await request(server, "/calculate?operation=add&a=1&b=2");
      expect(duration).toBeLessThan(100);
    });

    it("Une requête en erreur 400 répond en moins de 100 ms", async () => {
      const { duration } = await request(server, "/calculate?operation=add&a=abc&b=2");
      expect(duration).toBeLessThan(100);
    });
  });

  describe("Headers de réponse", () => {
    it("Vérification des headers sur statut 200", async () => {
      const { headers } = await request(server, "/calculate?operation=add&a=1&b=2");
      expect(headers["content-type"]).toBe("application/json; charset=utf-8");
      expect(headers["access-control-allow-origin"]).toBe("*");
    });

    it("Vérification des headers sur statut 400", async () => {
      const { headers } = await request(server, "/calculate?operation=add&a=abc&b=2");
      expect(headers["content-type"]).toBe("application/json; charset=utf-8");
      expect(headers["access-control-allow-origin"]).toBe("*");
    });

    it("Vérification des headers sur statut 404", async () => {
      const { headers } = await request(server, "/unknown");
      expect(headers["content-type"]).toBe("application/json; charset=utf-8");
      expect(headers["access-control-allow-origin"]).toBe("*");
    });
  });

  describe("OPTIONS /calculate — preflight CORS", () => {
    it("Vérifie la réponse OPTIONS", async () => {
      const { status, body, headers } = await request(server, "/calculate", "OPTIONS");
      expect(status).toBe(204);
      expect(body).toBeNull();
      expect(headers["access-control-allow-origin"]).toBe("*");
      expect(headers["access-control-allow-methods"]).toContain("GET");
    });
  });

  describe("GET /calculate — cas nominaux", () => {
    it.each`
      operation     | a     | b     | expected
      ${"add"}      | ${2}  | ${3}  | ${5}
      ${"subtract"} | ${10} | ${4}  | ${6}
      ${"multiply"} | ${6}  | ${7}  | ${42}
      ${"divide"}   | ${20} | ${5}  | ${4}
      ${"add"}      | ${-5} | ${-3} | ${-8}
      ${"subtract"} | ${-5} | ${-3} | ${-2}
      ${"multiply"} | ${-3} | ${-4} | ${12}
      ${"divide"}   | ${-10}| ${-2} | ${5}
    `("devrait retourner $expected pour $operation avec a=$a et b=$b", async ({ operation, a, b, expected }) => {
      const { status, body } = await request(server, `/calculate?operation=${operation}&a=${a}&b=${b}`);
      expect(status).toBe(200);
      expect(body).toMatchObject({ operation, a, b, result: expected });
    });

    it("Division décimale", async () => {
      const { body } = await request(server, "/calculate?operation=divide&a=10&b=3");
      expect(body.result).toBeCloseTo(3.333);
    });

    it("Décimaux en query string", async () => {
      const { body } = await request(server, "/calculate?operation=add&a=1.5&b=2.5");
      expect(body.result).toBe(4);
    });

    it("Contrat JSON 200", async () => {
      const { body } = await request(server, "/calculate?operation=multiply&a=3&b=4");
      expect(body).toHaveProperty("operation");
      expect(body).toHaveProperty("a");
      expect(body).toHaveProperty("b");
      expect(body).toHaveProperty("result");
      expect(body).not.toHaveProperty("error");
    });
  });

  describe("Méthode non autorisée", () => {
    it("POST renvoie 405 et un body d'erreur", async () => {
      const { status, body, headers } = await request(server, "/calculate", "POST");
      expect(status).toBe(405);
      expect(body.error).toBe("Méthode non autorisée. Utiliser GET.");
      expect(headers["allow"]).toBe("GET, OPTIONS");
    });

    it("PUT renvoie 405", async () => {
      const { status } = await request(server, "/calculate", "PUT");
      expect(status).toBe(405);
    });
  });

  describe("GET /calculate — erreurs 400", () => {
    it("b manquant", async () => {
      const { status, body } = await request(server, "/calculate?operation=add&a=2");
      expect(status).toBe(400);
      expect(body.error).toMatch(/Paramètres attendus : operation, a, b/);
    });

    it("a manquant", async () => {
      const { status, body } = await request(server, "/calculate?operation=add&b=2");
      expect(status).toBe(400);
      expect(body.error).toMatch(/Paramètres attendus : operation, a, b/);
    });

    it("a non numérique", async () => {
      const { status, body } = await request(server, "/calculate?operation=add&a=abc&b=3");
      expect(status).toBe(400);
      expect(body.error).toMatch(/Les paramètres a et b doivent être des nombres./);
    });

    it("b non numérique", async () => {
      const { status, body } = await request(server, "/calculate?operation=add&a=3&b=abc");
      expect(status).toBe(400);
      expect(body.error).toMatch(/Les paramètres a et b doivent être des nombres./);
    });

    it("Division par zéro", async () => {
      const { status, body } = await request(server, "/calculate?operation=divide&a=10&b=0");
      expect(status).toBe(400);
      expect(body.error).toBe("Division par zéro impossible.");
    });

    it("Opération inconnue", async () => {
      const { status, body } = await request(server, "/calculate?operation=modulo&a=10&b=3");
      expect(status).toBe(400);
      expect(body.error).toMatch(/Opération inconnue. Utiliser : add, subtract, multiply, divide/);
    });

    it("operation absent", async () => {
      const { status, body } = await request(server, "/calculate?a=5&b=3");
      expect(status).toBe(400);
      expect(body.error).toMatch(/Paramètres attendus : operation, a, b/);
    });

    it("Contrat JSON erreur", async () => {
      const { body } = await request(server, "/calculate?operation=add&a=2");
      expect(body).toHaveProperty("error");
      expect(body).not.toHaveProperty("result");
    });
  });

  describe("GET — autres routes", () => {
    it("Route inconnue", async () => {
      const { status, body } = await request(server, "/unknown");
      expect(status).toBe(404);
      expect(body.error).toBe("Route introuvable.");
    });

    it("Racine", async () => {
      const { status, headers } = await request(server, "/");
      expect(status).toBe(200);
      expect(headers["content-type"]).toBe("text/html; charset=utf-8");
    });

    it("Slash final", async () => {
      const { status, body } = await request(server, "/calculate/");
      expect(status).toBe(404);
      expect(body).toHaveProperty("error");
    });
  });

  describe("Cas limites — edge cases", () => {
    it("Très grande valeur", async () => {
      const { status, body } = await request(server, "/calculate?operation=add&a=1e308&b=1e308");
      expect(status).toBe(200);
      expect(body.result === null || body.result === "Infinity" || body.result === Infinity).toBe(true);
    });

    it("a=-0", async () => {
      const { status, body } = await request(server, "/calculate?operation=add&a=-0&b=5");
      expect(status).toBe(200);
      expect(body.result).toBe(5);
      expect(body.a).toBe(0);
    });
  });
});