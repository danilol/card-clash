import type { PlayerView } from '@card-clash/engine';

export type Status = 'connecting' | 'connected' | 'disconnected';
export type Screen = 'home' | 'waiting' | 'join' | 'match' | 'result';
export type Match = {
  matchId: string;
  link: string;
  nickname: string;
  playerId: string;
  token: string;
} | null;

export type State = {
  status: Status;
  screen: Screen;
  match: Match;
  view: PlayerView | null;
  error: string | null;
  rematchPending: boolean;
};

export type Action =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | {
      type: 'match/joined';
      matchId: string;
      link: string;
      nickname: string;
      playerId: string;
      token: string;
    }
  | {
      type: 'match/state';
      view: PlayerView;
    }
  | {
      type: 'match/ended';
      view: PlayerView;
    }
  | {
      type: 'match/rematchPending';
    }
  | {
      type: 'match/error';
      error: string;
    };

export const initialState: State = {
  status: 'connecting',
  screen: initialScreen(),
  match: null,
  view: null,
  error: null,
  rematchPending: false,
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'connected':
      return { ...state, status: 'connected' };
    case 'disconnected':
      return { ...state, status: 'disconnected' };
    case 'match/joined':
      return {
        ...state,
        status: 'connected',
        screen: 'waiting',
        match: {
          matchId: action.matchId,
          link: action.link,
          nickname: action.nickname,
          playerId: action.playerId,
          token: action.token,
        },
        view: null,
      };
    case 'match/state':
      return {
        ...state,
        screen: 'match',
        view: action.view,
        error: null,
        rematchPending: false,
      };
    case 'match/error':
      return {
        ...state,
        error: action.error,
      };
    case 'match/ended':
      return {
        ...state,
        screen: 'result',
        view: action.view,
        rematchPending: false,
      };
    case 'match/rematchPending':
      return {
        ...state,
        rematchPending: true,
      };
  }
}

function initialScreen(): Screen {
  if (typeof window === 'undefined') return 'home';
  const matchId = new URLSearchParams(window.location.search).get('match');
  return matchId ? 'join' : 'home';
}
