import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@card-clash/engine';
import { addPlayer, getMatch } from '../store/matchStore.js';
import { matchJoinCommandSchema } from '@card-clash/engine';

export function registerMatchHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
) {
  io.on('connection', (socket) => {
    socket.on('match:join', (payload, ack) => {
      console.log('match:join', payload);

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
      }
    });
  });

  return io;
}
