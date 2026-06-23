import { Router } from 'express';
import { createMatchSchema } from '@card-clash/engine';
import { createMatch } from '../store/matchStore.js';

export const matchesRouter = Router();

matchesRouter.post('/api/matches', (req, res) => {
  const parsedName = createMatchSchema.safeParse(req.body);

  if (parsedName.success) {
    const result = createMatch();

    return res.status(201).json({
      matchId: result.matchId,
    });
  } else {
    return res.status(400).json({
      error: 'Invalid nickname',
      details: parsedName.error,
    });
  }
});
