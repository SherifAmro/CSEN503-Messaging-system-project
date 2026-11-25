/**
 * Serves the built React client (Person 3's `npm run build` output)
 * from the same HTTP server as the WebSocket.
 *
 * Why: phones then need only ONE address (http://<laptop-ip>:3000).
 * The page loads over HTTP, and the app opens its WebSocket to the same
 * host and port, so there is nothing else to configure on the phone.
 *
 * Uses only Node's built-in fs and path modules, so there is no extra
 * dependency to install or explain.
 */

const fs = require("fs");
const path = require("path");

// Vite puts the production build in client/dist.
const CLIENT_DIR = path.join(__dirname, "..", "..", "client", "dist");

// The browser needs the right Content-Type to run JS and apply CSS.
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

function serveClient(req, res) {
  const indexFile = path.join(CLIENT_DIR, "index.html");

  // No build yet (Person 3 hasn't run `npm run build`): say so clearly
  // instead of a confusing 404.
  if (!fs.existsSync(indexFile)) {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Client not built yet. Run `npm run build` in /client.");
    return;
  }

  // Drop any ?query part and decode %20 etc. A bad %-sequence is just a 400.
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  // Resolve the file inside CLIENT_DIR. The check below blocks requests
  // like /../../server/src/index.js from reading files outside the build.
  // (We add path.sep so a sibling folder like "dist-old" doesn't pass.)
  const filePath = path.join(CLIENT_DIR, urlPath);
  if (filePath !== CLIENT_DIR && !filePath.startsWith(CLIENT_DIR + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  // A real file (JS, CSS, image) -> send it. Anything else (e.g. "/" or
  // a client-side route like "/chat/bob") -> send index.html and let
  // React decide what to show.
  const isFile = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  sendFile(res, isFile ? filePath : indexFile);
}

function sendFile(res, filePath) {
  const type = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  // Streaming avoids loading the whole file into memory at once.
  fs.createReadStream(filePath).pipe(res);
}

module.exports = { serveClient };
