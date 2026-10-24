import { io, type Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@card-clash/engine';

// No URL: connect to the page's own origin (story 4.2, D26). In production
// the server serves the page; in dev the Vite proxy forwards /socket.io.
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();
