import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { RankCardRow, type RankCardRowProps } from "../../client/components/RankCardRow";
import type { Rank } from "../../shared/game/cards";

function descendants(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return [];
    return [child, ...descendants(child.props.children as ReactNode)];
  });
}

export function getRankRow(element: ReactNode, label: string): RankCardRowProps {
  const row = descendants(element).find((child) => child.type === RankCardRow && child.props.label === label);
  if (!row) throw new Error(`Missing rank row: ${label}`);
  return row.props as unknown as RankCardRowProps;
}

export function getRankButton(row: RankCardRowProps, rank: Rank) {
  const button = descendants(RankCardRow(row)).find((child) => child.type === "button" && child.props["data-rank"] === rank);
  if (!button) throw new Error(`Missing card: ${rank}`);
  return button.props as unknown as { disabled: boolean; onClick: () => void; "aria-pressed": boolean };
}

export function rankButtonTag(markup: string, label: string, rank: Rank): string {
  const field = markup.split(`aria-label="${label}"`)[1]?.split("</fieldset>")[0];
  const button = field?.match(new RegExp(`<button\\b[^>]*data-rank="${rank}"[^>]*>`))?.[0];
  if (!button) throw new Error(`Missing rendered card: ${label} ${rank}`);
  return button;
}
