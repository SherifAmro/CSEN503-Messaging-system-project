/**
 * Tracks which users are online and which socket(s) each one has.
 * A user may have more than one socket (e.g. phone + laptop tab),
 * so each userId maps to a Set of sockets.
 */

const online = new Map(); // userId -> Set<WebSocket>

function add(userId, socket) {
  if (!online.has(userId)) online.set(userId, new Set());
  online.get(userId).add(socket);
}

function remove(userId, socket) {
  const set = online.get(userId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) online.delete(userId);
}

function socketsOf(userId) {
  return online.get(userId) || new Set();
}

function isOnline(userId) {
  return online.has(userId);
}

function onlineUsers() {
  return [...online.keys()];
}

function count() {
  return online.size;
}

module.exports = { add, remove, socketsOf, isOnline, onlineUsers, count };
