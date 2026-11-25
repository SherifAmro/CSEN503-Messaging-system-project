/**
 * Entry point for the chat server.
 *
 * Responsibilities (Person 1 — server core):
 *  - Start one HTTP server that the phones reach over the LAN (laptop IP).
 *  - Attach a WebSocket server to it (transport: TCP underneath).
 *  - Accept many simultaneous clients, track who is online.
 *  - Route each incoming message to its recipient(s).
 *  - Survive any one client disconnecting without affecting the others.
 *
 * Protocol encode/decode (Person 2), the database/sync (Person 4) and
 * group logic (Person 3) plug in through the small hooks marked below.
 */

const http = require("http");
const os = require("os");
const { WebSocketServer } = require("ws");
const clients = require("./clients");
const { routeMessage } = require("./router");
const { serveClient } = require("./static");

const PORT = process.env.PORT || 3000;
const HEARTBEAT_MS = 10_000; // how often we ping clients to detect dead sockets

// One HTTP server for everything: the health check, the React app, and
// (through the "upgrade" request) the WebSocket. Phones need one address.
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, online: clients.onlineUsers() }));
    return;
  }
  // TODO (Person 4): handle the metrics page route here, before the client.
  serveClient(req, res);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket, req) => {
  const ip = req.socket.remoteAddress;
  socket.isAlive = true;
  socket.userId = null; // set once the client sends a "hello"
  console.log(`[connect] ${ip}`);

  // A pong proves the client is still reachable.
  socket.on("pong", () => {
    socket.isAlive = true;
  });

  socket.on("message", (raw) => {
    let msg;
    try {
      // TODO (Person 2): replace with protocol.decode(raw), which handles
      // both Protocol A (JSON) and Protocol B (custom format).
      msg = JSON.parse(raw.toString());
    } catch {
      socket.send(JSON.stringify({ type: "error", reason: "bad_format" }));
      return; // a malformed message must never crash the server
    }

    if (msg.type === "hello") {
      // First message from a client: identify which user owns this socket.
      socket.userId = msg.from;
      clients.add(msg.from, socket);
      console.log(`[hello] ${msg.from} (${clients.count()} online)`);
      // TODO (Person 4): push any messages missed while offline.
      return;
    }

    if (!socket.userId) {
      socket.send(JSON.stringify({ type: "error", reason: "say_hello_first" }));
      return;
    }

    routeMessage(socket, msg);
  });

  // Closing or erroring affects ONLY this socket; other clients keep going.
  socket.on("close", () => cleanup(socket, "close"));
  socket.on("error", (err) => {
    console.log(`[error] ${socket.userId || ip}: ${err.message}`);
    cleanup(socket, "error");
  });
});

function cleanup(socket, reason) {
  if (socket.userId) {
    clients.remove(socket.userId, socket);
    console.log(`[${reason}] ${socket.userId} left (${clients.count()} online)`);
  }
}

// Heartbeat: phones that lose Wi-Fi often don't send a clean close.
// Ping every client; any that didn't answer the last ping is terminated.
const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.isAlive) {
      socket.terminate(); // triggers "close" -> cleanup
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, HEARTBEAT_MS);

wss.on("close", () => clearInterval(heartbeat));

// Listen on all interfaces (0.0.0.0) so phones on the same Wi-Fi can connect.
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
  console.log("Phones on the same Wi-Fi: open this in the browser:");
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === "IPv4" && !a.internal) {
        console.log(`  http://${a.address}:${PORT}`);
      }
    }
  }
});
