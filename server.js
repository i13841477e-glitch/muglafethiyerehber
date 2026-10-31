const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

// Yalnızca site dosyaları sunulur; server.js, package.json vb. dışarı açılmaz.
function isPublic(rel) {
  return rel === "index.html" || rel === "tatil.html" || /^(css|js)[\\/]/.test(rel);
}

function resolve(urlPath) {
  let rel;
  try {
    rel = path.normalize(decodeURIComponent(urlPath)).replace(/^[\\/]+/, "");
  } catch {
    return null;
  }
  if (rel === "" || rel === ".") rel = "index.html";
  if (!path.extname(rel)) rel += ".html"; // firebase cleanUrls karşılığı: /tatil
  return isPublic(rel) ? path.join(ROOT, rel) : null;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }
  const file = resolve(new URL(req.url, "http://localhost").pathname);
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Sayfa bulunamadı");
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Sayfa bulunamadı");
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      "Content-Length": data.length,
    });
    res.end(req.method === "HEAD" ? undefined : data);
  });
});

server.listen(PORT, "0.0.0.0", () => console.log(`Sunucu ${PORT} portunda`));
