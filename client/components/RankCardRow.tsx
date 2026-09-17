import { RANKS, type Rank } from "../../shared/game/cards";
import { CardFace } from "./CardFace";

export interface RankCardRowProps {
  label: string;
  selectedRank: Rank;
  enabledRanks: Rank[];
  onSelect: (rank: Rank) => void;
  count?: number;
  disabled?: boolean;
}

export function RankCardRow({ label, selectedRank, enabledRanks, onSelect, count = 1, disabled = false }: RankCardRowProps) {
  return (
    <fieldset className="rank-card-field" aria-label={label}>
      <legend>{label}{count > 1 && <small>×{count}</small>}</legend>
      <div className="rank-card-array">
        {RANKS.map((rank) => {
          const enabled = enabledRanks.includes(rank);
          const selected = selectedRank === rank;
          return (
            <button
              key={rank}
              type="button"
              className={`rank-card-button${selected ? " is-selected" : ""}`}
              data-rank={rank}
              aria-label={`${label}: ${rank}`}
              aria-pressed={selected}
              disabled={disabled || !enabled}
              title={disabled ? "Declaring…" : enabled ? `Choose ${rank}` : "This rank cannot make a legal raise."}
              onClick={() => { if (!disabled && enabled) onSelect(rank); }}
            >
              <CardFace card={{ rank }} />
              {selected && <span className="rank-card-check" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
