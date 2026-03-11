import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";
const distDir = path.join(__dirname, "dist");
const indexPath = path.join(distDir, "index.html");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendFile(filePath, response) {
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
    "Cache-Control": filePath === indexPath ? "no-cache" : "public, max-age=31536000, immutable",
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const rawPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = rawPath.replace(/^\/+/, "");
    const normalizedPath = path.normalize(relativePath).replace(/^([.][.][/\\])+/, "");
    const requestedPath = normalizedPath === "" ? indexPath : path.join(distDir, normalizedPath);

    if (existsSync(requestedPath)) {
      const fileStats = await stat(requestedPath);
      if (fileStats.isFile()) {
        sendFile(requestedPath, response);
        return;
      }
    }

    if (existsSync(indexPath)) {
      sendFile(indexPath, response);
      return;
    }

    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Missing build output. Run npm run build first.");
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Unexpected server error.");
  }
});

server.listen(port, host, () => {
  console.log(`Static server listening on http://${host}:${port}`);
});
