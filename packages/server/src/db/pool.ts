import pg from 'pg';
import { loadConfig } from '../config.js';

// The ONLY file that imports pg (architecture: data boundary).
// Lazy so importing this module has no side effects; connections are only
// opened on the first query.
let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: loadConfig().DATABASE_URL });
  }
  return pool;
}
