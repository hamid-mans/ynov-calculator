const http = require("http");

function request(server, url, method = "GET") {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const options = {
      method,
      path: url,
      port: server.address().port,
      host: "127.0.0.1",
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        let body = null;

        if (data) {
          try {
            body = JSON.parse(data);
          } catch (e) {
            body = data;
          }
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          duration: Date.now() - start,
        });
      });
    });

    req.on("error", (err) => reject(err));
    req.end();
  });
}

module.exports = { request };