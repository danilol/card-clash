import { useEffect, useReducer, useState } from 'react';
import { reducer, initialState } from './state/reducer';
import { socket } from './socket';
import { HomeScreen } from './components/HomeScreen';
import { JoinScreen } from './components/JoinScreen';
import type { ErrorPayload, PlayerView, StatKey } from '@card-clash/engine';
import { MatchScreen } from './components/MatchScreen';
import { WaitingView } from './components/WaitingView';
import { ResultView } from './components/ResultView';

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function onConnect() {
      dispatch({ type: 'connected' });
    }
    function onDisconnect() {
      dispatch({ type: 'disconnected' });
    }
    function onConnectError() {
      dispatch({ type: 'disconnected' });
    }
    function onMatchState(view: PlayerView) {
      dispatch({ type: 'match/state', view });
      setPending(false);
    }
    function onMatchEnded(view: PlayerView) {
      dispatch({ type: 'match/ended', view });
      setPending(false);
    }
    function onMatchError(payload: ErrorPayload) {
      dispatch({ type: 'match/error', error: payload.message });
      setPending(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('match:state', onMatchState);
    socket.on('match:error', onMatchError);
    socket.on('match:ended', onMatchEnded);

    if (socket.connected) dispatch({ type: 'connected' });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('match:state', onMatchState);
      socket.off('match:error', onMatchError);
      socket.off('match:ended', onMatchEnded);
    };
  }, []);

  switch (state.screen) {
    case 'home':
      return <HomeScreen dispatch={dispatch} />;
    case 'waiting':
      return <WaitingView view={state.match} />;
    case 'join':
      return <JoinScreen dispatch={dispatch} />;
    case 'result':
      if (!state.view || !state.match) return null;
      const { matchId, token } = state.match;
      return (
        <ResultView
          view={state.view}
          onRematch={() => {
            socket.emit('match:rematch', {
              matchId,
              token,
            });
            dispatch({ type: 'match/rematchPending' });
          }}
          rematchPending={state.rematchPending}
        />
      );
    case 'match': {
      if (!state.view || !state.match) return null;
      const { matchId, token } = state.match;
      return (
        <MatchScreen
          view={state.view}
          error={state.error}
          onSelectStat={(stat: StatKey) => {
            setPending(true);
            socket.emit('match:selectStat', { matchId, token, stat });
          }}
          disabled={pending}
        />
      );
    }
    default:
      return (
        <div>
          <h1>Card Clash - {state.status}</h1>
        </div>
      );
  }
}

export default App;
