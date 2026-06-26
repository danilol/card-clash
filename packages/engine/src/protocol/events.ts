import type { PlayerView } from '../types.js';
import type { MatchJoinCommand } from './commands.js';

export interface ClientToServerEvents {
  'match:join': (
    payload: MatchJoinCommand,
    ack: (response: AckPayload) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'match:error': (error: ErrorPayload) => void;
  'match:state': (payload: PlayerView) => void;
  'match:ended': (payload: PlayerView) => void;
}

export type AckPayload =
  | {
      ok: true;
      playerId: string;
      token: string;
    }
  | {
      ok: false;
      error: ErrorPayload;
    };

export type ErrorPayload = {
  code: CommandErrorCode;
  message: string;
};

export type CommandErrorCode =
  | 'INVALID_BODY'
  | 'MATCH_NOT_FOUND'
  | 'MATCH_FULL'
  | 'MATCH_STARTED'
  | 'ALREADY_JOINED';
