import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

/** Wrap a socket emit in a Promise (expects server to ack with { ok, ... }) */
export function emitWithAck(event, data = {}) {
  return new Promise((resolve, reject) => {
    socket.emit(event, data, (res) => {
      if (res?.ok) resolve(res);
      else reject(new Error(res?.error || 'Unknown error'));
    });
  });
}

// ── Keep-alive: ping the server's /health endpoint every 10 minutes so that
// hosting platforms (e.g. Render free tier) don't spin the process down while
// a game is in progress.
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let _keepAliveTimer = null;

export function startKeepAlive() {
  stopKeepAlive();
  _keepAliveTimer = setInterval(() => {
    fetch(`${SERVER_URL}/health`).catch(() => { /* ignore — server unreachable */ });
  }, KEEP_ALIVE_INTERVAL_MS);
}

export function stopKeepAlive() {
  if (_keepAliveTimer !== null) {
    clearInterval(_keepAliveTimer);
    _keepAliveTimer = null;
  }
}
