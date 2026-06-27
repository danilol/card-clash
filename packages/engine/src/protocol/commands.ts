import { z } from 'zod';

export const nicknameSchema = z.string().trim().min(1).max(50);
export const createMatchSchema = z.object({ nickname: nicknameSchema });
export const selectStatCommandSchema = z.object({
  matchId: z.string(),
  token: z.string(),
  stat: z.enum([
    'bounty',
    'age',
    'haki',
    'loyalty',
    'devilFruitMastery',
    'fearFactor',
    'speed',
    'battleIQ',
  ]),
});
export type SelectStatPayload = z.infer<typeof selectStatCommandSchema>;

export const matchJoinCommandSchema = z.object({
  matchId: z.string(),
  nickname: nicknameSchema,
});

export type MatchJoinCommand = z.infer<typeof matchJoinCommandSchema>;
