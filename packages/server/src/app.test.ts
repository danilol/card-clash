import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

describe('GET /api/health', () => {
  it("returns 200 with { status: 'ok' }", async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('locks CORS to the client dev origin (not *)', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });
});
