/**
 * Quick terminal client for testing the server without the React UI.
 * Usage:  node test-client.js <yourName> [serverUrl]
 * Then type:  <recipient> <message>
 */

const WebSocket = require("ws");
const readline = require("readline");
const crypto = require("crypto");

const me = process.argv[2] || "alice";
const url = process.argv[3] || "ws://localhost:3000";
const ws = new WebSocket(url);

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "hello", from: me }));
  console.log(`Connected as ${me}. Type: <to> <message>`);
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === "chat") console.log(`\n${msg.from}: ${msg.body}`);
  else console.log(`\n[${msg.type}]`, msg.msgId || msg.reason || "");
});

ws.on("close", () => {
  console.log("Disconnected");
  process.exit(0);
});

readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const [to, ...rest] = line.trim().split(" ");
  if (!to || rest.length === 0) return;
  ws.send(
    JSON.stringify({
      type: "chat",
      msgId: crypto.randomUUID(),
      from: me,
      to,
      timestamp: Date.now(),
      body: rest.join(" "),
    })
  );
});
