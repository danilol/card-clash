import { Router } from 'express';
import { createMatchSchema } from '@card-clash/engine';
import { createMatchEntry } from '../store/matchStore.js';
import { findRecent } from '../db/matchRepository.js';

export const matchesRouter = Router();

matchesRouter.get('/api/matches/recent', async (_req, res) => {
  try {
    const matches = await findRecent();
    return res.status(200).json(matches);
  } catch (err) {
    // The home screen must stay usable when the DB is down (story 3.2, 1c).
    console.error('[db] recent matches: failed to read', err);
    return res.status(500).json({
      error: {
        code: 'DB_UNAVAILABLE',
        message: 'Could not load recent matches',
      },
    });
  }
});

matchesRouter.post('/api/matches', (req, res) => {
  const parsedName = createMatchSchema.safeParse(req.body);

  if (parsedName.success) {
    const result = createMatchEntry();

    return res.status(201).json({
      matchId: result.matchId,
    });
  } else {
    return res.status(400).json({
      error: {
        code: 'INVALID_BODY',
        message: 'Nickname is required (1–50 characters).',
      },
    });
  }
});
