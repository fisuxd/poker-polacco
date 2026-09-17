import { useEffect, useMemo, useState } from "react";
import { formatBid } from "../../shared/game/bids";
import { BidBuilder } from "../components/BidBuilder";
import { Brand } from "../components/Brand";
import { Cheatsheet } from "../components/Cheatsheet";
import { LeaveRoomButton } from "../components/LeaveRoomButton";
import { GameScene } from "../game3d/GameScene";
import { gameApi } from "../socket/gameSocket";
import { useGameStore } from "../state/gameStore";

function useCountdown(deadline: number | null): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [deadline]);
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1_000)) : null;
}

export function GameScreen() {
  const state = useGameStore((store) => store.publicState)!;
  const privateState = useGameStore((store) => store.privateState);
  const cheatsheetOpen = useGameStore((store) => store.cheatsheetOpen);
  const setCheatsheetOpen = useGameStore((store) => store.setCheatsheetOpen);
  const bidBuilderOpen = useGameStore((store) => store.bidBuilderOpen);
  const setBidBuilderOpen = useGameStore((store) => store.setBidBuilderOpen);
  const setError = useGameStore((store) => store.setError);
  const [busy, setBusy] = useState(false);
  const playerId = privateState?.playerId;
  const isMyTurn = state.phase === "BIDDING" && state.currentTurnId === playerId;
  const isHost = state.hostId === playerId;
  const countdown = useCountdown(state.turnDeadline);
  const currentPlayer = state.players.find((player) => player.id === state.currentTurnId);
  const loser = state.players.find((player) => player.id === state.result?.loserId);
  const winner = state.players.find((player) => player.id === state.winnerId);
  const canRaise = state.currentBid?.type !== "ROYAL_FLUSH";

  useEffect(() => {
    if (!isMyTurn) setBidBuilderOpen(false);
  }, [isMyTurn, setBidBuilderOpen]);

  const act = async (action: () => Promise<{ ok: boolean; error?: string }>, closeBuilder = false) => {
    setBusy(true);
    const response = await action();
    if (!response.ok) setError(response.error ?? "Action failed.");
    else if (closeBuilder) setBidBuilderOpen(false);
    setBusy(false);
  };

  const phaseMessage = useMemo(() => {
    if (state.phase === "ROUND_START") return `Round ${state.roundNumber} · ${currentPlayer?.nickname ?? "Player"} opens`;
    if (state.phase === "BIDDING") return isMyTurn ? "Your move" : `${currentPlayer?.nickname ?? "Player"} is deciding`;
    if (state.phase === "REVEAL") return "Bluff called · revealing the table";
    if (state.phase === "ROUND_RESULT") return `${loser?.nickname ?? "A player"} loses the round`;
    return "Match complete";
  }, [state.phase, state.roundNumber, currentPlayer?.nickname, isMyTurn, loser?.nickname]);

  return (
    <main className="game-screen">
      <div className="scene-layer"><GameScene state={state} privateState={privateState} /></div>
      <header className="game-topbar">
        <Brand compact />
        <div className="round-meta"><span>ROOM <strong>{state.roomCode}</strong></span><span>ROUND <strong>{state.roundNumber}</strong></span></div>
        <div className="game-tools">
          <button className="ghost-button cheatsheet-button" onClick={() => setCheatsheetOpen(true)}>？ Cheatsheet</button>
          <LeaveRoomButton />
        </div>
      </header>

      <div className="phase-pill"><span className={isMyTurn ? "live-dot" : "status-dot"} />{phaseMessage}{countdown !== null && state.phase === "BIDDING" && <b className={countdown <= 10 ? "urgent" : ""}>{countdown}s</b>}</div>

      <aside className="table-roster" aria-label="Players">
        {state.players.map((player) => (
          <div key={player.id} className={`roster-player ${player.id === state.currentTurnId ? "current" : ""} ${player.eliminated ? "eliminated" : ""}`}>
            <span>{player.nickname.slice(0, 1).toUpperCase()}</span><div><strong>{player.nickname}{player.id === playerId ? " · YOU" : ""}</strong><small>{player.leftRoom ? "LEFT ROOM" : player.eliminated ? "ELIMINATED" : `${player.cardCount} CARD${player.cardCount === 1 ? "" : "S"}`}{!player.connected && !player.leftRoom ? " · AWAY" : ""}{player.id === state.hostId ? " · HOST" : ""}</small></div>
          </div>
        ))}
      </aside>

      <section className="sr-only" aria-label="Current declaration" aria-live="polite">
        {state.result && (state.phase === "REVEAL" || state.phase === "ROUND_RESULT") ? (
          <>
            <p className="eyebrow">Challenge result</p>
            <strong className={state.result.bidWasTrue ? "truth" : "falsehood"}>{state.result.bidWasTrue ? "THE BID WAS TRUE" : "THE BID WAS FALSE"}</strong>
            <span>{formatBid(state.result.bid)}</span>
            <small>{loser?.nickname} {state.result.eliminated ? "is eliminated" : `will hold ${state.result.newCardCount} cards`}</small>
          </>
        ) : (
          <>
            <p className="eyebrow">Current bid</p>
            <strong>{state.currentBid ? formatBid(state.currentBid) : "The table is open"}</strong>
            <span>{state.lastBidderId ? `Declared by ${state.players.find((player) => player.id === state.lastBidderId)?.nickname}` : "First player must declare"}</span>
          </>
        )}
      </section>

      {isMyTurn && (
        <section className="action-dock glass-panel">
          <div><p className="eyebrow">Your turn</p><strong>{state.currentBid ? "Raise it—or test their nerve." : "Open with any available declaration."}</strong></div>
          <div className="action-buttons">
            {canRaise && <button className="primary-button" onClick={() => setBidBuilderOpen(true)}>↑ Raise <span>Rilancia</span></button>}
            {state.currentBid && <button className="danger-button" disabled={busy} onClick={() => act(() => gameApi.bluff(state.roomCode))}>! Call bluff <span>Bugiardo!</span></button>}
          </div>
        </section>
      )}

      {state.phase === "MATCH_OVER" && (
        <div className="modal-scrim winner-scrim">
          <section className="winner-modal glass-panel">
            <p className="eyebrow">The table has spoken</p>
            <div className="winner-suit">♠</div>
            <h1>{winner?.nickname ?? "No one"} wins</h1>
            <p>Last player standing after {state.roundNumber} rounds.</p>
            {isHost ? <div className="winner-actions"><button className="primary-button" disabled={busy || state.players.filter((player) => player.connected).length < 2} onClick={() => act(() => gameApi.rematch(state.roomCode))}>Play a rematch</button><button className="ghost-button" disabled={busy} onClick={() => act(() => gameApi.returnLobby(state.roomCode))}>Return to lobby</button></div> : <p className="waiting-copy">Waiting for the host to choose what happens next…</p>}
            <LeaveRoomButton className="text-button winner-leave-button" />
          </section>
        </div>
      )}

      {bidBuilderOpen && <BidBuilder state={state} busy={busy} onClose={() => setBidBuilderOpen(false)} onSubmit={(bid) => act(() => gameApi.bid(state.roomCode, bid), true)} />}
      {cheatsheetOpen && <Cheatsheet currentCategory={state.currentBid?.type} onClose={() => setCheatsheetOpen(false)} />}
    </main>
  );
}
