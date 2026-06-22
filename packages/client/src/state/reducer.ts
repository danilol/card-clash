export type Status = 'connecting' | 'connected' | 'disconnected';

type State = { status: Status };
type Action = { type: 'connected' } | { type: 'disconnected' };

export const initialState: State = { status: 'connecting' };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'connected':
      return { ...state, status: 'connected' };
    case 'disconnected':
      return { ...state, status: 'disconnected' };
  }
}
