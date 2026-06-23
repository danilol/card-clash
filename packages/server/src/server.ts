import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
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
  },
);

registerMatchHandlers(io);

httpServer.listen(port, () =>
  console.log('server on http://localhost:' + port),
);
