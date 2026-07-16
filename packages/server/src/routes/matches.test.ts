import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { findRecent } from '../db/matchRepository.js';
import type { RecentMatch } from '../db/matchRecord.js';

// Mock at the repository seam (story 3.2, decision 1g) — no test opens a DB
// connection. The factory replaces the WHOLE module, so insertMatch is
// stubbed too.
vi.mock('../db/matchRepository.js', () => ({
  findRecent: vi.fn(),
  insertMatch: vi.fn(),
  RECENT_MATCHES_LIMIT: 20,
}));

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

  it('rejects a missing nickname with 400 and the shared error shape', async () => {
    const res = await request(app).post('/api/matches').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'INVALID_BODY',
      message: expect.any(String),
    });
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

describe('GET /api/matches/recent (story 3.2)', () => {
  beforeEach(() => {
    vi.mocked(findRecent).mockReset();
  });

  const MATCH: RecentMatch = {
    id: 42,
    playerOneNickname: 'Luffy',
    playerTwoNickname: 'Zoro',
    winnerNickname: 'Luffy',
    endReason: 'roundCap',
    roundsPlayed: 100,
    createdAt: '2026-07-16T12:00:00.000Z',
  };

  it('returns the mapped list newest-first as the repository gives it (200)', async () => {
    vi.mocked(findRecent).mockResolvedValue([MATCH]);
    const res = await request(app).get('/api/matches/recent');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([MATCH]);
  });

  it('returns an empty array when there are no rows (200, AC3 server side)', async () => {
    vi.mocked(findRecent).mockResolvedValue([]);
    const res = await request(app).get('/api/matches/recent');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('DB failure → 500 shared error shape, [db] log, no crash (AC-1c)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(findRecent).mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/api/matches/recent');
    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      code: 'DB_UNAVAILABLE',
      message: expect.any(String),
    });
    expect(
      errorSpy.mock.calls.some((call) =>
        call.join(' ').includes('recent matches'),
      ),
    ).toBe(true);
    errorSpy.mockRestore();
  });
});
