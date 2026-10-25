import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createApp } from './app.js';

describe('GET /api/health', () => {
  it("returns 200 with { status: 'ok' }", async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  // Story 4.2 (1e): page and server share one origin, so no CORS config —
  // a foreign site may not read REST responses (stricter than the old lock).
  it('sends no CORS header to a foreign origin', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('serving the built client (story 4.2, 1f)', () => {
  const INDEX_HTML = '<!doctype html><div id="root"></div>';
  const clientDir = mkdtempSync(join(tmpdir(), 'card-clash-client-'));
  writeFileSync(join(clientDir, 'index.html'), INDEX_HTML);
  const withClient = createApp(clientDir);

  afterAll(() => rmSync(clientDir, { recursive: true, force: true }));

  it('serves index.html at /', async () => {
    const res = await request(withClient).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toBe(INDEX_HTML);
  });

  it('serves index.html for a join link (/?match=<id>)', async () => {
    const res = await request(withClient).get('/?match=abc123');
    expect(res.status).toBe(200);
    expect(res.text).toBe(INDEX_HTML);
  });

  it('keeps the API working alongside the page', async () => {
    const res = await request(withClient).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('answers an unknown /api path with 404, not the page', async () => {
    const res = await request(withClient).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('id="root"');
  });

  it('starts without a client build (dev: Vite serves the page)', async () => {
    const noClient = createApp(join(clientDir, 'missing'));
    const res = await request(noClient).get('/');
    expect(res.status).toBe(404);
  });
});
