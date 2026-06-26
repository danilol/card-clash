import { useEffect, useReducer } from 'react';
import { reducer, initialState } from './state/reducer';
import { socket } from './socket';
import { HomeScreen } from './components/HomeScreen';
import { JoinScreen } from './components/JoinScreen';
import type { PlayerView } from '@card-clash/engine';
import { MatchScreen } from './components/MatchScreen';
import { WaitingView } from './components/WaitingView';

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
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
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('match:state', onMatchState);

    if (socket.connected) dispatch({ type: 'connected' });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('match:state', onMatchState);
    };
  }, []);

  switch (state.screen) {
    case 'home':
      return <HomeScreen dispatch={dispatch} />;
    case 'waiting':
      return <WaitingView view={state.match} />;
    case 'join':
      return <JoinScreen dispatch={dispatch} />;
    case 'match':
      return state.view ? <MatchScreen view={state.view} /> : null;
    default:
      return (
        <div style={{ backgroundColor: 'lightgreen' }}>
          <h1>Card Clash - {state.status}</h1>
        </div>
      );
  }
}

export default App;
