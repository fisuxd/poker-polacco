export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <span className="brand__eyebrow">A game of nerve &amp; numbers</span>
      <span className="brand__title">Poker <i>Polacco</i></span>
      {!compact && <span className="brand__sub">The whole table is your hand.</span>}
    </div>
  );
}
