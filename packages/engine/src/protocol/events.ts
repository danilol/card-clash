import type {
  PlayerView,
  CommandErrorCode as EngineCommandErrorCode,
} from '../types.js';
import type {
  MatchJoinCommand,
  RematchCommand,
  SelectStatPayload,
} from './commands.js';

export interface ClientToServerEvents {
  'match:join': (
    payload: MatchJoinCommand,
    ack: (response: AckPayload) => void,
  ) => void;
  'match:selectStat': (payload: SelectStatPayload) => void;
  'match:ended': () => void;
  'match:rematch': (payload: RematchCommand) => void;
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

export type LobbyErrorCode =
  | 'INVALID_BODY'
  | 'MATCH_NOT_FOUND'
  | 'MATCH_FULL'
  | 'MATCH_STARTED'
  | 'ALREADY_JOINED'
  | 'NOT_IN_MATCH';

export type WireErrorCode = LobbyErrorCode | EngineCommandErrorCode;

export type ErrorPayload = {
  code: WireErrorCode;
  message: string;
};
