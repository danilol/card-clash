import { useEffect, useReducer } from 'react';
import { reducer, initialState } from './state/reducer';
import { socket } from './socket';
import { HomeScreen } from './components/HomeScreen';

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

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    if (socket.connected) dispatch({ type: 'connected' });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, []);

  switch (state.screen) {
    case 'home':
      return <HomeScreen dispatch={dispatch} />;
    case 'waiting':
      return <div>Waiting for opponent... {state.status}</div>;
    default:
      return (
        <div>
          <h1>Card Clash - {state.status}</h1>
        </div>
      );
  }
}

export default App;
