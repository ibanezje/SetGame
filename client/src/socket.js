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
