import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('POST /api/matches', () => {
  it('creates a match and returns a string matchId (201)', async () => {
    const res = await request(app)
      .post('/api/matches')
      .send({ nickname: 'Luffy' });

    expect(res.status).toBe(201);
    expect(typeof res.body.matchId).toBe('string');
    expect(res.body.matchId.length).toBeGreaterThan(0);
  });

  it('gives a different matchId on each create', async () => {
    const a = await request(app)
      .post('/api/matches')
      .send({ nickname: 'Zoro' });
    const b = await request(app)
      .post('/api/matches')
      .send({ nickname: 'Nami' });
    expect(a.body.matchId).not.toBe(b.body.matchId);
  });

  it('rejects a missing nickname with 400', async () => {
    const res = await request(app).post('/api/matches').send({});
    expect(res.status).toBe(400);
  });

  it('rejects an empty nickname with 400', async () => {
    const res = await request(app).post('/api/matches').send({ nickname: '' });
    expect(res.status).toBe(400);
  });

  it('rejects a whitespace-only nickname with 400 (trim)', async () => {
    const res = await request(app)
      .post('/api/matches')
      .send({ nickname: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects an over-length nickname with 400', async () => {
    const res = await request(app)
      .post('/api/matches')
      .send({ nickname: 'x'.repeat(51) });
    expect(res.status).toBe(400);
  });
});
