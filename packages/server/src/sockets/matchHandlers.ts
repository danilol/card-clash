import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@card-clash/engine';
import { addPlayer, getMatch, startMatch } from '../store/matchStore.js';
import {
  createMatch,
  defaultRng,
  matchJoinCommandSchema,
  onePieceDeck,
} from '@card-clash/engine';
import { buildStartViews } from './startViews.js';

export function registerMatchHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
) {
  io.on('connection', (socket) => {
    socket.on('match:join', (payload, ack) => {
      const payloadSchema = matchJoinCommandSchema.safeParse(payload);

      if (!payloadSchema.success) {
        ack({
          ok: false,
          error: {
            code: 'INVALID_BODY',
            message: 'Invalid join payload (matchId and nickname required).',
          },
        });
        return;
      } else {
        const entry = getMatch(payloadSchema.data.matchId);

        if (!entry) {
          ack({
            ok: false,
            error: { code: 'MATCH_NOT_FOUND', message: 'Match not found' },
          });
          return;
        }

        if (entry.players.length >= 2) {
          ack({
            ok: false,
            error: { code: 'MATCH_FULL', message: 'Match is full' },
          });
          return;
        }

        if (entry.status !== 'waiting') {
          ack({
            ok: false,
            error: { code: 'MATCH_NOT_FOUND', message: 'Match is not waiting' },
          });
          return;
        }

        if (entry.players.some((p) => p.socketId === socket.id)) {
          ack({
            ok: false,
            error: { code: 'MATCH_FULL', message: 'Already joined' },
          });
          return;
        }

        const playerId = crypto.randomUUID();
        const token = crypto.randomUUID();

        addPlayer(payloadSchema.data.matchId, {
          playerId,
          token,
          nickname: payloadSchema.data.nickname,
          socketId: socket.id,
        });

        socket.join(payloadSchema.data.matchId);
        ack({ ok: true, playerId: playerId, token: token });

        if (entry.players.length === 2) {
          const p1 = entry.players[0];
          const p2 = entry.players[1];
          const matchState = createMatch(
            onePieceDeck,
            [p1.playerId, p2.playerId],
            defaultRng,
          );

          startMatch(payloadSchema.data.matchId, matchState);

          for (const { socketId, view } of buildStartViews(
            matchState,
            entry.players,
          )) {
            io.to(socketId).emit('match:state', view);
          }
        }
      }
    });
  });

  return io;
}
