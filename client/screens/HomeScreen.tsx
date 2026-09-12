import { FormEvent, useState } from "react";
import { Brand } from "../components/Brand";
import { gameApi } from "../socket/gameSocket";
import { useGameStore } from "../state/gameStore";

export function HomeScreen() {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);
  const setError = useGameStore((state) => state.setError);
  const connection = useGameStore((state) => state.connection);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = mode === "create"
      ? await gameApi.createRoom(nickname)
      : await gameApi.joinRoom(nickname, roomCode);
    if (!response.ok) setError(response.error ?? "Could not enter the room.");
    setBusy(false);
  };

  return (
    <main className="home-screen">
      <div className="home-ambience" aria-hidden="true"><span>♠</span><span>♥</span><span>♦</span><span>♣</span></div>
      <section className="home-card glass-panel">
        <Brand />
        <div className="mode-switch" role="tablist" aria-label="Room action">
          <button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")} role="tab">Create a room</button>
          <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")} role="tab">Join a room</button>
        </div>
        <form onSubmit={submit} className="entry-form">
          <label>
            <span>Your table name</span>
            <input autoFocus maxLength={20} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="e.g. The Fox" autoComplete="nickname" />
          </label>
          {mode === "join" && (
            <label>
              <span>Six-character room code</span>
              <input className="room-code-input" maxLength={6} value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="7KMFQ2" autoComplete="off" />
            </label>
          )}
          <button className="primary-button full-width" disabled={busy || connection !== "connected" || !nickname.trim() || (mode === "join" && roomCode.length !== 6)}>
            {busy ? "Taking your seat…" : mode === "create" ? "Open a private table" : "Take your seat"}
          </button>
        </form>
        <p className="fine-print">2–6 players · No account required · Share the code privately</p>
      </section>
    </main>
  );
}
