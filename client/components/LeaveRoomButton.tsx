import { useState } from "react";
import { gameApi } from "../socket/gameSocket";
import { useGameStore } from "../state/gameStore";

export function LeaveRoomButton({ className = "ghost-button leave-room-button" }: { className?: string }) {
  const state = useGameStore((store) => store.publicState);
  const playerId = useGameStore((store) => store.privateState?.playerId);
  const connected = useGameStore((store) => store.connection === "connected" && !store.reconnecting);
  const setError = useGameStore((store) => store.setError);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!state) return null;

  const player = state.players.find((candidate) => candidate.id === playerId);
  const forfeitsMatch = state.phase !== "LOBBY" && state.phase !== "MATCH_OVER" && !player?.eliminated;
  const isHost = state.hostId === playerId;

  const leave = async () => {
    setBusy(true);
    const response = await gameApi.leave(state.roomCode);
    if (!response.ok) setError(response.error ?? "Could not leave the room.");
    setBusy(false);
  };

  return (
    <>
      <button className={className} disabled={busy || !connected} onClick={() => setConfirming(true)}>Leave room</button>
      {confirming && (
        <div className="modal-scrim leave-scrim" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) setConfirming(false);
        }}>
          <section className="leave-modal glass-panel" role="dialog" aria-modal="true" aria-label="Leave this room?">
            <p className="eyebrow">Leaving the table</p>
            <h2>Leave this room?</h2>
            <p>{forfeitsMatch
              ? "You will forfeit this match and return to the home screen. Your seat will not be reserved."
              : "You will leave the room and return to the home screen."}</p>
            {isHost && state.players.some((candidate) => candidate.id !== playerId && !candidate.leftRoom) && (
              <p className="host-transfer-note">Host ownership will pass to another player. The room stays open.</p>
            )}
            <div className="leave-actions">
              <button className="ghost-button" disabled={busy} onClick={() => setConfirming(false)}>Stay at table</button>
              <button className="danger-button" disabled={busy || !connected} onClick={leave}>{busy ? "Leaving…" : "Leave room"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
