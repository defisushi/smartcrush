import type { PnlSummary, RosterEntry, RosterUpdate } from "../types";

export type RosterSort = "pnl" | "winRate";
export type SortDirection = "worst" | "best";

export function sinceMatchPerformance(
  summary: PnlSummary,
): NonNullable<RosterUpdate["performance"]> {
  const sales =
    Number.isFinite(summary.traded_times) && summary.traded_times >= 0
      ? summary.traded_times
      : null;
  return {
    pnl: summary.realized_pnl_usd,
    winRate:
      sales !== null &&
      sales > 0 &&
      Number.isFinite(summary.win_rate) &&
      summary.win_rate >= 0 &&
      summary.win_rate <= 1
        ? summary.win_rate
        : null,
    sales,
  };
}

export function sortRoster(
  roster: RosterEntry[],
  metric: RosterSort,
  direction: SortDirection,
) {
  const value = (entry: RosterEntry) =>
    metric === "pnl" ? entry.pnlSinceAdded : entry.winRateSinceAdded;
  return [...roster].sort((a, b) => {
    const av = value(a),
      bv = value(b);
    const aKnown = av != null && Number.isFinite(av);
    const bKnown = bv != null && Number.isFinite(bv);
    if (!aKnown || !bKnown) return aKnown ? -1 : bKnown ? 1 : 0;
    return direction === "worst" ? av! - bv! : bv! - av!;
  });
}
