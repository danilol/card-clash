import { Container, getContainer } from '@cloudflare/containers';

interface Env {
  GAME_SERVER: DurableObjectNamespace<GameServer>;
  DATABASE_URL: string;
}

export class GameServer extends Container<Env> {
  defaultPort = 3000; // the image's EXPOSE
  // SPIKE value — short so the sleep test is fast (story 4.2, 1b).
  // Set to the production value (e.g. '30m') after the spike passes.
  sleepAfter = '2m';
  // Worker secret (wrangler secret put DATABASE_URL) → container env.
  envVars = {
    DATABASE_URL: this.env.DATABASE_URL,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Everything — REST and the Socket.IO WebSocket upgrade — goes to the
    // one fixed instance. Never route by request; the store is in-memory.
    return getContainer(env.GAME_SERVER, 'singleton').fetch(request);
  },
};
