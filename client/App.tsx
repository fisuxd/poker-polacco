import { HomeScreen } from "./screens/HomeScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { GameScreen } from "./screens/GameScreen";
import { useGameStore } from "./state/gameStore";

export default function App() {
  const publicState = useGameStore((state) => state.publicState);
  const error = useGameStore((state) => state.error);
  const setError = useGameStore((state) => state.setError);
  const connection = useGameStore((state) => state.connection);
  const reconnecting = useGameStore((state) => state.reconnecting);

  return (
    <>
      {reconnecting && !publicState ? <div className="loading-screen"><span className="card-loader">PP</span><p>Finding your reserved seat…</p></div>
        : !publicState ? <HomeScreen />
          : publicState.phase === "LOBBY" ? <LobbyScreen />
            : <GameScreen />}
      {connection === "disconnected" && <div className="offline-banner">Connection lost. Your seat is reserved for 60 seconds…</div>}
      {error && <div className="error-toast" role="alert"><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}
    </>
  );
}
