import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { matchesRouter } from './routes/matches.js';

// The built client (vite → packages/client/dist). Resolved from this file's
// location, so it works from src/ (dev, tests), dist/ and the Docker image.
export const CLIENT_DIST = fileURLToPath(
  new URL('../../client/dist', import.meta.url),
);

// No CORS config (story 4.2, D26): the page, REST and Socket.IO share one
// origin — in production because this server serves the page, in dev via
// the Vite proxy. Other sites get no CORS permission to read REST responses.
// (CORS never covered WebSocket upgrades; that is safe here because a
// player's token lives only in their own tab.)
export function hasClientBuild(clientDir: string = CLIENT_DIST): boolean {
  return existsSync(clientDir);
}

export function createApp(clientDir: string = CLIENT_DIST) {
  const app = express();

  app.use(express.json({ limit: '10kb' }));
  app.use(matchesRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // After the API routes. Join links are /?match=<id> — path "/" — so
  // static serving of index.html needs no SPA fallback route. In dev the
  // build usually doesn't exist (Vite serves the page): skip, still start.
  if (hasClientBuild(clientDir)) {
    app.use(express.static(clientDir));
  }

  return app;
}

export const app = createApp();
