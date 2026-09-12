import { useState } from "react";
import { Brand } from "../components/Brand";
import { gameApi } from "../socket/gameSocket";
import { useGameStore } from "../state/gameStore";

export function LobbyScreen() {
  const state = useGameStore((store) => store.publicState)!;
  const playerId = useGameStore((store) => store.privateState?.playerId);
  const setError = useGameStore((store) => store.setError);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const isHost = playerId === state.hostId;

  const act = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    const response = await action();
    if (!response.ok) setError(response.error ?? "Action failed.");
    setBusy(false);
  };

  const copyCode = async () => {
    await navigator.clipboard?.writeText(state.roomCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  return (
    <main className="lobby-screen">
      <header className="top-bar"><Brand compact /><span className="connection-pill">Private table</span></header>
      <section className="lobby-layout">
        <div className="lobby-code glass-panel">
          <p className="eyebrow">Invite players with code</p>
          <button className="room-code" onClick={copyCode} aria-label="Copy room code">{state.roomCode}</button>
          <p className="copy-hint">{copied ? "Copied to clipboard" : "Tap the code to copy"}</p>
        </div>
        <div className="lobby-roster glass-panel">
          <div className="panel-heading"><div><p className="eyebrow">At the table</p><h2>{state.players.length} / 6 players</h2></div><span className="live-dot" /></div>
          <ol className="player-list">
            {state.players.map((player) => (
              <li key={player.id}>
                <span className="seat-number">{player.seat + 1}</span>
                <span className="avatar-token">{player.nickname.slice(0, 1).toUpperCase()}</span>
                <span className="player-name">{player.nickname}{player.id === playerId && <small>YOU</small>}</span>
                {player.id === state.hostId && <span className="host-badge">HOST</span>}
                {!player.connected && <span className="offline-badge">RECONNECTING</span>}
              </li>
            ))}
            {Array.from({ length: 6 - state.players.length }, (_, index) => <li className="empty-seat" key={index}><span className="seat-number">{state.players.length + index + 1}</span><span>Waiting for a player…</span></li>)}
          </ol>
          {isHost ? (
            <button className="primary-button full-width" disabled={busy || state.players.filter((player) => player.connected).length < 2} onClick={() => act(() => gameApi.start(state.roomCode))}>
              {state.players.length < 2 ? "Waiting for one more player" : "Deal the cards"}
            </button>
          ) : <p className="waiting-copy">The host will start when everyone is ready.</p>}
          <button className="text-button leave-button" disabled={busy} onClick={() => act(() => gameApi.leave(state.roomCode))}>Leave table</button>
        </div>
      </section>
    </main>
  );
}
