import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { loadConfig } from './config.js';
import { app } from './app.js';

// Fail fast: an invalid/missing .env stops the server before it listens.
// (ESM evaluates all imports first — safe because no module reads env at
// import time; pool/config are lazy.)
loadConfig();
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@card-clash/engine';
import { registerMatchHandlers } from './sockets/matchHandlers.js';

const port = 3000;
const CLIENT_ORIGIN = 'http://localhost:5173';

export const httpServer = createServer(app);

const io: Server<ClientToServerEvents, ServerToClientEvents> = new Server(
  httpServer,
  {
    cors: {
      origin: CLIENT_ORIGIN,
    },
    // FR5: detect a vanished client in ≈10s (5s ping cadence + 5s pong wait),
    // not the ~45s Socket.IO defaults. A blip that recovers within the window
    // never fires 'disconnect' (story 2.6, decisions 6a/6f).
    pingInterval: 5000,
    pingTimeout: 5000,
  },
);

registerMatchHandlers(io);

httpServer.listen(port, () =>
  console.log('server on http://localhost:' + port),
);
