import { io } from 'socket.io-client';

const URL = import.meta.env.DEV ? 'http://localhost:3000' : '';

export const socket = io(URL, {
  withCredentials: true,
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
});
