import { RotateCcw } from "lucide-react";
import type { SessionData } from "../types";
import { relativeTime } from "../utils/formatters";
import { freshnessLabel } from "../utils/freshness";
import { SignalCard } from "./SignalCard";
import { SkeletonCard } from "./SkeletonCard";
import { EmptyState } from "./EmptyState";
import { SignalsSummary } from "./SignalsSummary";
import { recentSignals } from "../utils/signalWindow";
export function SignalsFeed({
  data,
  loading,
  demo,
  onRefresh,
  onSwipe,
  onCopy,
}: {
  data: SessionData;
  loading: boolean;
  demo: boolean;
  onRefresh: () => void;
  onSwipe: () => void;
  onCopy: (s: string) => void;
}) {
  const signals = recentSignals(data.signals);
  return (
    <>
      <div className="list-heading roster-list-heading signals-refresh-row">
        <div className="roster-refresh-control">
          {data.roster.length > 0 && (
            <span>
              {data.signalsRefreshStatus === "partial"
                ? `Trades checked ${relativeTime(data.signalsUpdatedAt)} · Context incomplete`
                : freshnessLabel(
                    data.signalsRefreshStatus,
                    data.signalsUpdatedAt,
                  )}
            </span>
          )}
          <button
            className="roster-text-button"
            onClick={onRefresh}
            disabled={loading || !data.roster.length}
            aria-label="Refresh signals"
          >
            <RotateCcw size={12} /> {loading ? "Checking…" : "Refresh"}
          </button>
        </div>
      </div>
      {signals.length > 0 && (
        <SignalsSummary signals={signals} onCopy={onCopy} />
      )}
      <div className="feed-heading">
        <span>24H Activity · Updates Hourly</span>
      </div>
      {!data.roster.length ? (
        <EmptyState
          title="Make the first move."
          action="Find a match"
          onAction={onSwipe}
        >
          <p>Add wallets to your roster first to see what they’re up to.</p>
        </EmptyState>
      ) : loading && !signals.length ? (
        <>
          <SkeletonCard compact label="Checking in on your matches…" />
          <SkeletonCard compact />
        </>
      ) : signals.length ? (
        <div className="signals-list">
          {signals.map((s) => (
            <SignalCard
              key={s.id}
              signal={s}
              demo={demo}
              nickname={data.nicknames[s.walletAddress.toLowerCase()]}
              onCopy={onCopy}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Playing hard to get.">
          <p>
            {data.signalsRefreshStatus === "failed" ||
            data.signalsRefreshStatus === "idle"
              ? "Recent activity is unavailable. Try Refresh above."
              : "Your roster’s been quiet. No new moves detected."}
          </p>
        </EmptyState>
      )}
      <p className="footnote">
        Context badges are estimates from current holdings and recent swaps;
        transfers can affect them. Updates run while the app is open. Nansen
        only exposes the last 24 hours. Activity older than 24 hours disappears
        from this view.
      </p>
    </>
  );
}
