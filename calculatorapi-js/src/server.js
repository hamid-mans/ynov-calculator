const http = require("http");
const fs = require("fs");
const path = require("path");
const Calculator = require("./calculator");

const PORT = 3000;
const calc = new Calculator();

function requestHandler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (parsedUrl.pathname === "/" || parsedUrl.pathname === "/index.html") {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, OPTIONS");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Méthode non autorisée. Utiliser GET." }));
      return;
    }

    const filePath = path.resolve(__dirname, "..", "public", "index.html");
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Erreur interne du serveur." }));
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(content);
    });
    return;
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, OPTIONS");
    res.end(JSON.stringify({ error: "Méthode non autorisée. Utiliser GET." }));
    return;
  }

  if (parsedUrl.pathname !== "/calculate") {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Route introuvable." }));
    return;
  }

  const operation = parsedUrl.searchParams.get("operation");
  const a = parsedUrl.searchParams.get("a");
  const b = parsedUrl.searchParams.get("b");

  if (!operation || a === null || b === null) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Paramètres attendus : operation, a, b" }));
    return;
  }

  const numA = Number(a);
  const numB = Number(b);

  if (Number.isNaN(numA) || Number.isNaN(numB)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Les paramètres a et b doivent être des nombres." }));
    return;
  }

  if (!["add", "subtract", "multiply", "divide"].includes(operation)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Opération inconnue. Utiliser : add, subtract, multiply, divide" }));
    return;
  }

  try {
    let result;
    if (operation === "add") result = calc.add(numA, numB);
    if (operation === "subtract") result = calc.subtract(numA, numB);
    if (operation === "multiply") result = calc.multiply(numA, numB);
    if (operation === "divide") result = calc.divide(numA, numB);

    res.statusCode = 200;
    res.end(JSON.stringify({ operation, a: numA, b: numB, result }));
  } catch (error) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: error.message }));
  }
}

const server = http.createServer(requestHandler);

function startServer() {
  server.listen(PORT);
}

/* istanbul ignore next */
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
  });
}

module.exports = { requestHandler, server, startServer };