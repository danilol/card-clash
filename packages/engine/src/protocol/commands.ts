import { z } from 'zod';

export const nicknameSchema = z.string().trim().min(1).max(50);
export const createMatchSchema = z.object({ nickname: nicknameSchema });

export const matchJoinCommandSchema = z.object({
  matchId: z.string(),
  nickname: nicknameSchema,
});

export type MatchJoinCommand = z.infer<typeof matchJoinCommandSchema>;
