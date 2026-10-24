import pg from 'pg';
import { loadConfig } from '../config.js';

// The ONLY file that imports pg (architecture: data boundary).
// Lazy so importing this module has no side effects; connections are only
// opened on the first query.
let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: loadConfig().DATABASE_URL,
      // A DB host that drops packets must not queue inserts forever (AC2),
      // and an established-but-hung query must not park requests forever.
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
    });
    // pg emits 'error' on the pool when an IDLE client's connection drops
    // (e.g. Postgres restarts). Without a listener that event would crash
    // the whole game server.
    pool.on('error', (err) => {
      console.error('[db] idle client error', err);
    });
  }
  return pool;
}

// Graceful shutdown (story 4.2): drain and close the pool if it was ever
// created. Safe to call when no pool exists (health-only traffic).
export async function closePool(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}
