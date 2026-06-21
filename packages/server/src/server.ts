import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';

const port = 3000;
const CLIENT_ORIGIN = 'http://localhost:5173';

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN } });

io.on('connection', (socket) => {
  console.log('client connected:', socket.id);
  socket.on('disconnect', () => console.log('client disconnected:', socket.id));
});

httpServer.listen(port, () =>
  console.log('server on http://localhost:' + port),
);
