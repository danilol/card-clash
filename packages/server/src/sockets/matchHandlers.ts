import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  PlayerId,
  ServerToClientEvents,
} from '@card-clash/engine';
import {
  acceptRematch,
  addPlayer,
  endMatch,
  getMatch,
  startMatch,
  updateMatchState,
  type MatchEntry,
} from '../store/matchStore.js';
import {
  applyCommand,
  createMatch,
  defaultRng,
  matchJoinCommandSchema,
  onePieceDeck,
  selectStatCommandSchema,
} from '@card-clash/engine';
import { buildStartViews } from './startViews.js';
import { rematchCommandSchema } from '@card-clash/engine';

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
            error: {
              code: 'MATCH_STARTED',
              message: 'Match has already started',
            },
          });
          return;
        }

        if (entry.players.some((p) => p.socketId === socket.id)) {
          ack({
            ok: false,
            error: { code: 'ALREADY_JOINED', message: 'Already joined' },
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

    socket.on('match:selectStat', (payload) => {
      const parsed = selectStatCommandSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('match:error', {
          code: 'INVALID_BODY',
          message: 'Invalid selectStat payload',
        });
        return;
      }

      const entry = getMatch(parsed.data.matchId);
      if (!entry || !entry.state) {
        socket.emit('match:error', {
          code: 'MATCH_NOT_FOUND',
          message: 'Match not found',
        });
        return;
      }

      const player = entry.players.find((p) => p.token === parsed.data.token);
      if (!player) {
        socket.emit('match:error', {
          code: 'NOT_IN_MATCH' as const,
          message: 'You are not in this match',
        });
        return;
      }

      const command = {
        type: 'selectStat',
        playerId: player.playerId,
        stat: parsed.data.stat,
      } as const;

      const result = applyCommand(entry.state, command);

      if (!result.ok) {
        socket.emit('match:error', result.error);
        return;
      }

      if (result.state.result) {
        // Persist the FINAL state (+ status 'ended') BEFORE emitting, so a
        // late/stray selectStat hits the terminal state → applyCommand returns
        // MATCH_OVER instead of resolving another round on a stale state.
        endMatch(parsed.data.matchId, result.state);
        for (const { socketId, view } of buildStartViews(
          result.state,
          entry.players,
        )) {
          io.to(socketId).emit('match:ended', view);
        }
        return;
      }

      updateMatchState(parsed.data.matchId, result.state);
      for (const { socketId, view } of buildStartViews(
        result.state,
        entry.players,
      )) {
        io.to(socketId).emit('match:state', view);
      }
    });

    socket.on('match:rematch', (payload) => {
      const parsed = rematchCommandSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('match:error', {
          code: 'INVALID_BODY',
          message: 'Invalid rematch payload',
        });
        return;
      }

      const entry = getMatch(parsed.data.matchId);

      if (!entry || !entry.state) {
        socket.emit('match:error', {
          code: 'MATCH_NOT_FOUND',
          message: 'Match not found',
        });
        return;
      }

      if (entry.status !== 'ended') {
        socket.emit('match:error', {
          code: 'MATCH_STARTED',
          message: 'Match is still in progress',
        });
        return;
      }

      const player = entry.players.find(
        (p) => p.token === parsed.data.token,
      );

      if (!player) {
        socket.emit('match:error', {
          code: 'NOT_IN_MATCH',
          message: 'You are not in this match',
        });
        return;
      }

      if (!isRematchAccepted(player.playerId, entry)) {
        acceptRematch(parsed.data.matchId, player.playerId);
      }

      if (entry.rematchAccepted.length === 2) {
        entry.rematchAccepted = [];

        const matchState = createMatch(
          onePieceDeck,
          entry.players.map((p) => p.playerId),
          defaultRng,
        );

        startMatch(parsed.data.matchId, matchState);

        for (const { socketId, view } of buildStartViews(
          matchState,
          entry.players,
        )) {
          io.to(socketId).emit('match:state', view);
        }
      }
    });
  });

  return io;
}

function isRematchAccepted(playerId: PlayerId, entry: MatchEntry): boolean {
  return entry.rematchAccepted.includes(playerId);
}
