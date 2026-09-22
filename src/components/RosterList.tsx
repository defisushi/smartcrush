import { useCallback, useState } from "react";
import { Heart, RotateCcw } from "lucide-react";
import type { RosterEntry as Entry } from "../types";
import { RosterEntry } from "./RosterEntry";
import { EmptyState } from "./EmptyState";
import { RosterCapacity } from "./RosterCapacity";
import { RosterDropdown } from "./RosterDropdown";
import { NicknameModal } from "./NicknameModal";
import { freshnessLabel, rosterFreshness } from "../utils/freshness";
import {
  sortRoster,
  type RosterSort,
  type SortDirection,
} from "../utils/roster";
export function RosterList({
  roster,
  nicknames,
  loading,
  onRefresh,
  onNickname,
  onCopy,
  onSwipe,
  onBreakUp,
}: {
  roster: Entry[];
  nicknames: Record<string, string>;
  loading: boolean;
  onRefresh: () => void;
  onNickname: (address: string, nickname: string) => void;
  onCopy: (address: string) => void;
  onSwipe: () => void;
  onBreakUp: (address: string) => void;
}) {
  const [metric, setMetric] = useState<RosterSort>("pnl");
  const [direction, setDirection] = useState<SortDirection>("worst");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const closeNickname = useCallback(() => setNaming(null), []);
  const sorted = sortRoster(roster, metric, direction);
  const freshness = rosterFreshness(roster);
  return (
    <>
      <div className="roster-page-capacity">
        <RosterCapacity count={roster.length} showExplanation={false} />
      </div>
      {roster.length ? (
        <>
          <div className="roster-sort-bar">
            <RosterDropdown
              label="Sort by"
              ariaLabel="Sort roster by"
              value={metric}
              onChange={setMetric}
              options={[
                { value: "pnl", label: "REALIZED P&L since matching" },
                { value: "winRate", label: "WIN RATE since matching" },
              ]}
            />
            <RosterDropdown
              label="Order"
              ariaLabel="Roster sort order"
              value={direction}
              onChange={setDirection}
              options={[
                { value: "worst", label: "Worst first" },
                { value: "best", label: "Best first" },
              ]}
            />
          </div>
          <div className="list-heading roster-list-heading">
            <div className="roster-refresh-control">
              <span>
                {freshnessLabel(freshness.status, freshness.checkedAt)}
              </span>
              <button
                className="roster-text-button"
                onClick={onRefresh}
                disabled={loading}
                aria-label="Refresh roster"
              >
                <RotateCcw size={12} /> {loading ? "Checking…" : "Refresh"}
              </button>
            </div>
          </div>
          <div className="roster-list">
            {sorted.map((entry) => (
              <RosterEntry
                key={entry.wallet.address}
                entry={entry}
                nickname={nicknames[entry.wallet.address.toLowerCase()]}
                expanded={expanded === entry.wallet.address}
                loading={loading}
                onToggle={() =>
                  setExpanded(
                    expanded === entry.wallet.address
                      ? null
                      : entry.wallet.address,
                  )
                }
                onNickname={() => setNaming(entry.wallet.address)}
                onCopy={() => onCopy(entry.wallet.address)}
                onBreakUp={() => onBreakUp(entry.wallet.address)}
              />
            ))}
          </div>
          <button className="button add-more" onClick={onSwipe}>
            {roster.length === 10
              ? "Back to Swipe"
              : `There’s still room for ${10 - roster.length} more ${
                  10 - roster.length === 1 ? "Smartcrush" : "Smartcrushes"
                }!`}
          </button>
          <p className="footnote">Nansen figures can lag by up to an hour.</p>
        </>
      ) : (
        <EmptyState title="Still single?">
          <p>Start swiping to find matches and build your roster!</p>
          <button className="button primary" onClick={onSwipe}>
            Find my first match <Heart size={17} />
          </button>
        </EmptyState>
      )}
      {naming && (
        <NicknameModal
          address={naming}
          nickname={nicknames[naming.toLowerCase()] || ""}
          onClose={closeNickname}
          onSave={(nickname) => {
            onNickname(naming, nickname);
            closeNickname();
          }}
        />
      )}
    </>
  );
}
