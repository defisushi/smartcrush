import { RotateCcw } from "lucide-react";
import type { SessionData } from "../types";
import { relativeTime } from "../utils/formatters";
import { SignalCard } from "./SignalCard";
import { SkeletonCard } from "./SkeletonCard";
import { EmptyState } from "./EmptyState";
import { SignalsSummary } from "./SignalsSummary";
export function SignalsFeed({
  data,
  loading,
  demo,
  onRefresh,
  onScout,
  onCopy,
}: {
  data: SessionData;
  loading: boolean;
  demo: boolean;
  onRefresh: () => void;
  onScout: () => void;
  onCopy: (s: string) => void;
}) {
  return (
    <>
      <div className="list-heading roster-list-heading signals-refresh-row">
        <div className="roster-refresh-control">
          {data.lastPolledAt > 0 && (
            <span>Updated {relativeTime(data.lastPolledAt)}</span>
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
      {data.signals.length > 0 && (
        <SignalsSummary signals={data.signals} onCopy={onCopy} />
      )}
      <div className="feed-heading">
        <span>24H Activity · Updates Hourly</span>
      </div>
      {!data.roster.length ? (
        <EmptyState
          title="Make the first move."
          action="Find a match"
          onAction={onScout}
        >
          <p>Add wallets to your roster first to see what they’re up to.</p>
        </EmptyState>
      ) : loading && !data.signals.length ? (
        <>
          <SkeletonCard compact label="Checking in on your matches…" />
          <SkeletonCard compact />
        </>
      ) : data.signals.length ? (
        <div className="signals-list">
          {data.signals.map((s) => (
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
          <p>Your roster’s been quiet. No new moves detected.</p>
        </EmptyState>
      )}
      <p className="footnote">
        Context badges are estimates from current holdings and recent swaps;
        transfers can affect them. Updates run while the app is open. Nansen
        only exposes the last 24 hours; saved signals stay here.
      </p>
    </>
  );
}
