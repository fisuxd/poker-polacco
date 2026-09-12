import { BID_CATEGORIES, CATEGORY_LABELS, type BidCategory } from "../../shared/game/bids";

const rules: Array<{ type: BidCategory; requirement: string; example: string; comparison: string }> = [
  { type: "HIGH_CARD", requirement: "At least one card of the declared rank.", example: "High Card: King", comparison: "Ace > King > Queen > … > 2." },
  { type: "PAIR", requirement: "Two cards with the same rank.", example: "Q Q", comparison: "Compare the pair rank; a pair of Aces is highest." },
  { type: "STRAIGHT", requirement: "Five consecutive ranks; suits do not matter. A–2–3–4–5 is allowed.", example: "7 8 9 10 J", comparison: "Compare the highest card: 5-high through Ace-high." },
  { type: "TWO_PAIR", requirement: "Two different pairs anywhere in the combined pool.", example: "K K + 8 8", comparison: "Compare the higher pair first, then the lower pair." },
  { type: "THREE_OF_A_KIND", requirement: "Three cards of the same rank.", example: "J J J", comparison: "Compare the rank of the three matching cards." },
  { type: "FULL_HOUSE", requirement: "Three of one rank and two of a different rank.", example: "4 4 4 + 8 8", comparison: "Compare the three-of-a-kind rank first, then the pair." },
  { type: "FOUR_OF_A_KIND", requirement: "All four cards of one rank.", example: "9 9 9 9", comparison: "Compare the rank of the four matching cards." },
  { type: "ROYAL_FLUSH", requirement: "10–J–Q–K–A, all in the same suit.", example: "10♥ J♥ Q♥ K♥ A♥", comparison: "The highest declaration. No suit outranks another." },
];

export function Cheatsheet({ currentCategory, onClose }: { currentCategory?: BidCategory; onClose: () => void }) {
  return (
    <div className="drawer-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="cheatsheet" role="dialog" aria-modal="true" aria-labelledby="cheatsheet-title">
        <header><div><p className="eyebrow">Keep it close</p><h2 id="cheatsheet-title">Poker Polacco Cheatsheet</h2></div><button className="close-button" onClick={onClose} aria-label="Close cheatsheet">×</button></header>
        <div className="cheatsheet__body">
          <section className="main-rule">
            <strong>The whole table is one hand.</strong>
            <p>Every declaration refers to <em>all hidden cards held by every active player combined</em>—not only the declarer's cards.</p>
          </section>
          <section>
            <p className="eyebrow">Lowest → highest</p>
            <h3>Its own ranking order</h3>
            <p className="warning-note">Important: this is not normal poker ranking. A Straight is below Two Pair.</p>
            <ol className="ranking-list">
              {BID_CATEGORIES.map((category) => <li key={category} className={category === currentCategory ? "current" : ""}><span>{CATEGORY_LABELS[category].it}</span><small>{CATEGORY_LABELS[category].en}</small>{category === currentCategory && <b>Current bid</b>}</li>)}
            </ol>
          </section>
          <section className="combination-rules">
            {rules.map((rule) => (
              <article key={rule.type} className={rule.type === currentCategory ? "current" : ""}>
                <span className="rule-number">{BID_CATEGORIES.indexOf(rule.type) + 1}</span>
                <div><h4>{CATEGORY_LABELS[rule.type].it} <small>{CATEGORY_LABELS[rule.type].en}</small></h4><p>{rule.requirement}</p><code>{rule.example}</code><p className="comparison">{rule.comparison}</p></div>
              </article>
            ))}
          </section>
          <section className="challenge-rules">
            <h3>Raise or challenge</h3>
            <ul>
              <li>Every new declaration must be strictly higher.</li>
              <li>After moving to a higher category, nobody can return to a lower one.</li>
              <li>Calling bluff reveals every card. If the bid is true, the challenger loses; if false, the declarer loses.</li>
              <li>A loss adds one card next round. Losing at five cards eliminates that player.</li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
