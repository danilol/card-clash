export type Status = 'connecting' | 'connected' | 'disconnected';
export type Screen = 'home' | 'waiting';
export type Match = {
  matchId: string;
  link: string;
  playerId: string;
  token: string;
} | null;

type State = { status: Status; screen: Screen; match: Match };
export type Action =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'match/created' }
  | {
      type: 'match/joined';
      matchId: string;
      link: string;
      playerId: string;
      token: string;
    };

export const initialState: State = {
  status: 'connecting',
  screen: 'home',
  match: null,
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'connected':
      return { ...state, status: 'connected' };
    case 'disconnected':
      return { ...state, status: 'disconnected' };
    case 'match/created':
      return {
        ...state,
        status: 'connected',
        screen: 'home',
        match: state.match,
      };
    case 'match/joined':
      return {
        ...state,
        status: 'connected',
        screen: 'waiting',
        match: {
          matchId: action.matchId,
          link: action.link,
          playerId: action.playerId,
          token: action.token,
        },
      };
  }
}
