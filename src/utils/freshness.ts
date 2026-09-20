import type { RefreshStatus, RosterEntry } from "../types";
import { relativeTime } from "./formatters";

export function rosterFreshness(roster: RosterEntry[]) {
  const times = roster.flatMap((r) => [r.pnlUpdatedAt, r.holdingsUpdatedAt]);
  const known = times.filter(
    (at): at is number => typeof at === "number" && at > 0,
  );
  const failed =
    roster.length > 0 &&
    roster.every((r) => r.performanceError && r.holdingsError);
  const hasError = roster.some((r) => r.performanceError || r.holdingsError);
  const incomplete = hasError || known.length !== times.length;
  const status: RefreshStatus = failed
    ? "failed"
    : incomplete
      ? known.length || hasError
        ? "partial"
        : "idle"
      : known.length
        ? "complete"
        : "idle";
  return { status, checkedAt: known.length ? Math.min(...known) : 0 };
}

export function freshnessLabel(
  status: RefreshStatus,
  checkedAt: number,
  now = Date.now(),
) {
  if (status === "failed")
    return checkedAt
      ? `Refresh failed · Last checked ${relativeTime(checkedAt, now)}`
      : "Refresh failed · No successful check";
  if (status === "partial")
    return checkedAt
      ? `Partially refreshed · Oldest check ${relativeTime(checkedAt, now)}`
      : "Partially refreshed · Some data unavailable";
  return checkedAt
    ? `Checked ${relativeTime(checkedAt, now)}`
    : "Not yet checked";
}
