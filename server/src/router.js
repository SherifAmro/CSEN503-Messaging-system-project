/**
 * Decides where each incoming chat message goes.
 *
 * Message shape (draft, final version agreed with Person 2):
 *   { type: "chat", msgId, from, to, timestamp, body }
 */

const WebSocket = require("ws");
const clients = require("./clients");

function routeMessage(senderSocket, msg) {
  if (msg.type !== "chat") return;

  // Stamp server receive time (used later for latency metrics).
  msg.serverTs = Date.now();

  // TODO (Person 4): save msg to the database BEFORE acknowledging,
  // and skip it if msgId was already stored (no duplicates).

  // Acknowledge to the sender so it knows not to retry (no loss).
  safeSend(senderSocket, { type: "ack", msgId: msg.msgId });

  // TODO (Person 3): if msg.to is a group, send to every member instead.
  deliverTo(msg.to, msg);
}

function deliverTo(userId, msg) {
  for (const socket of clients.socketsOf(userId)) {
    safeSend(socket, msg);
  }
  // If the recipient is offline, nothing is sent now;
  // the stored message is delivered when they reconnect (Person 4).
}

// Send only to open sockets, and never let one bad socket throw.
function safeSend(socket, obj) {
  if (socket.readyState !== WebSocket.OPEN) return;
  try {
    // TODO (Person 2): replace with protocol.encode(obj, socket.protocolType)
    socket.send(JSON.stringify(obj));
  } catch (err) {
    console.log(`[send-failed] ${socket.userId}: ${err.message}`);
  }
}

module.exports = { routeMessage, safeSend };
