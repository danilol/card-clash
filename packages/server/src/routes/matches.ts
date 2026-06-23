import { Router } from 'express';
import { createMatchSchema } from '@card-clash/engine';
import { createMatchEntry } from '../store/matchStore.js';

export const matchesRouter = Router();

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
