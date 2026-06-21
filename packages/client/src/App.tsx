import { useEffect, useReducer } from 'react';
import { reducer, initialState } from './state/reducer';
import { socket } from './socket';

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    function onConnect() {
      dispatch({ type: 'connected' });
    }
    function onDisconnect() {
      dispatch({ type: 'disconnected' });
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) dispatch({ type: 'connected' });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return <h1>Card Clash - {state.status}</h1>;
}

export default App;
