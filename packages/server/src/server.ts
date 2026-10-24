import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { loadConfig } from './config.js';
import { closePool } from './db/pool.js';
import { app } from './app.js';

// Fail fast: an invalid/missing .env stops the server before it listens.
// (ESM evaluates all imports first — safe because no module reads env at
// import time; pool/config are lazy.)
const { PORT } = loadConfig();
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@card-clash/engine';
import { registerMatchHandlers } from './sockets/matchHandlers.js';

export const httpServer = createServer(app);

// No `cors` option: the page is same-origin (story 4.2, D26 — see app.ts).
const io: Server<ClientToServerEvents, ServerToClientEvents> = new Server(
  httpServer,
  {
    // FR5: detect a vanished client in ≈10s (5s ping cadence + 5s pong wait),
    // not the ~45s Socket.IO defaults. A blip that recovers within the window
    // never fires 'disconnect' (story 2.6, decisions 6a/6f).
    pingInterval: 5000,
    pingTimeout: 5000,
  },
);

registerMatchHandlers(io);

httpServer.listen(PORT, () => console.log(`server listening on port ${PORT}`));

// Graceful shutdown (story 4.2, closes the deferred pool.end() item):
// io.close() disconnects all sockets AND closes the attached http server,
// then the pg pool drains. A hung close cannot block the exit — the force
// timer is unref()'d so it never keeps the process alive on its own.
async function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} received — closing server`);
  setTimeout(() => {
    console.error('[shutdown] close timed out — forcing exit');
    process.exit(1);
  }, 5000).unref();
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await closePool();
  console.log('[shutdown] clean exit');
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
