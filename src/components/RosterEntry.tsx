import { useId } from "react";
import {
  ChevronDown,
  Copy,
  Flag,
  Heart,
  HeartCrack,
  Pencil,
  Trophy,
} from "lucide-react";
import type { RosterEntry as Entry } from "../types";
import {
  multiple,
  matchTime,
  percent,
  shortAddress,
  signedMoney,
} from "../utils/formatters";
export function RosterEntry({
  entry,
  nickname,
  expanded,
  loading,
  onToggle,
  onNickname,
  onCopy,
  onBreakUp,
}: {
  entry: Entry;
  nickname?: string;
  expanded: boolean;
  loading: boolean;
  onToggle: () => void;
  onNickname: () => void;
  onCopy: () => void;
  onBreakUp: () => void;
}) {
  const { wallet, pnlSinceAdded, winRateSinceAdded } = entry;
  const name = nickname || shortAddress(wallet.address);
  const detailsId = useId();
  return (
    <article
      className={`roster-card ${expanded ? "is-expanded" : ""}`}
      aria-label={`Smartcrush ${name}`}
      onClick={(event) => {
        if (
          !(event.target as HTMLElement).closest(
            "button, a, input, select, textarea",
          ) &&
          !window.getSelection()?.toString()
        )
          onToggle();
      }}
    >
      <div className="roster-identity">
        <div className="roster-name">
          {nickname && (
            <div className="roster-display-name-line">
              <h3 title={name}>{name}</h3>
              <button
                className="roster-nickname-button"
                onClick={onNickname}
                aria-label="Edit nickname"
                title="Edit nickname"
              >
                <Pencil size={11} strokeWidth={2} /> Edit Nickname
              </button>
            </div>
          )}
          <div className="roster-address-line">
            {nickname ? (
              <p className="roster-wallet-address" title={wallet.address}>
                {shortAddress(wallet.address)}
              </p>
            ) : (
              <h3 title={wallet.address}>{shortAddress(wallet.address)}</h3>
            )}
            <button
              className="roster-inline-copy"
              onClick={onCopy}
              aria-label={`Copy wallet address ${wallet.address}`}
              title={wallet.address}
            >
              <Copy size={13} />
            </button>
            {!nickname && (
              <button
                className="roster-nickname-button"
                onClick={onNickname}
                aria-label="Add nickname"
                title="Add nickname"
              >
                <Pencil size={11} strokeWidth={2} /> Add Nickname
              </button>
            )}
          </div>
          <div className="roster-meta-line">
            <span className="roster-nansen-label">
              {wallet.label || "Smart money wallet"}
            </span>
            <span
              className="match-date"
              aria-label={`Matched ${matchTime(entry.addedAt)}${
                entry.salesSinceAdded != null
                  ? `, sold ${entry.salesSinceAdded} ${entry.salesSinceAdded === 1 ? "time" : "times"} since matching`
                  : ""
              }`}
            >
              Matched {matchTime(entry.addedAt)}
              {entry.salesSinceAdded != null && (
                <>
                  , sold {entry.salesSinceAdded}{" "}
                  {entry.salesSinceAdded === 1 ? "time" : "times"} since
                  matching.
                </>
              )}
            </span>
          </div>
        </div>
      </div>
      <div className="roster-performance">
        <div>
          <span>
            Win rate <small>since matching</small>
          </span>
          <strong>
            {winRateSinceAdded == null ? "—" : percent(winRateSinceAdded)}
          </strong>
        </div>
        <div>
          <span>
            Realized P&amp;L <small>since matching</small>
          </span>
          <strong
            className={
              pnlSinceAdded == null
                ? ""
                : pnlSinceAdded >= 0
                  ? "profit"
                  : "loss"
            }
          >
            {pnlSinceAdded == null ? "—" : signedMoney(pnlSinceAdded, true)}
          </strong>
        </div>
      </div>
      <div className="roster-card-actions">
        <button
          className="roster-disclosure"
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? "Hide" : "Show"} details for ${name}`}
          onClick={onToggle}
        >
          {expanded ? "Hide Details" : "View Details"} <ChevronDown size={15} />
        </button>
        <button className="break-up-button" onClick={onBreakUp}>
          <HeartCrack size={13} /> Break up
        </button>
      </div>
      <div id={detailsId} hidden={!expanded} className="roster-details">
        <section className="roster-current-section">
          <div className="section-label">
            <Heart size={14} />
            <h3>Currently Into</h3>
          </div>
          {entry.holdingsUpdatedAt ? (
            <>
              <div className="token-chips">
                {wallet.currentHoldings.slice(0, 4).map((holding) => (
                  <span className="token-chip" key={holding.address}>
                    {holding.symbol}
                  </span>
                ))}
              </div>
              {!wallet.currentHoldings.length && (
                <p className="roster-detail-note">No current holdings found.</p>
              )}
            </>
          ) : (
            <p className="roster-detail-note">
              {loading
                ? "Checking current holdings…"
                : "Current holdings unavailable. Try Refresh above."}
            </p>
          )}
        </section>
        <section className="roster-baseline-section">
          <div className="section-label">
            <Flag size={14} />
            <h3>Stats At Match</h3>
          </div>
          <p className="roster-detail-note">
            This Smartcrush&apos;s stats when you first swiped on em.
          </p>
          <div className="roster-baseline-metrics">
            <div>
              <span>
                Win rate <small>at matching</small>
              </span>
              <strong>{percent(wallet.winRate)}</strong>
            </div>
            <div>
              <span>
                Realized P&amp;L <small>at matching</small>
              </span>
              <strong
                className={wallet.realizedPnlUsd >= 0 ? "profit" : "loss"}
              >
                {signedMoney(wallet.realizedPnlUsd, true)}
              </strong>
            </div>
          </div>
        </section>
        <section className="hits-section">
          <div className="section-label">
            <Trophy size={14} />
            <h3>Greatest Hits</h3>
          </div>
          <p className="roster-detail-note">
            This Smartcrush&apos;s historical wins when you first swiped on em.
          </p>
          {wallet.topTokens.length ? (
            <div className="trophies">
              {wallet.topTokens.slice(0, 3).map((token) => (
                <div className="trophy" key={token.address}>
                  <span title={token.symbol}>{token.symbol}</span>
                  <strong>{multiple(token.realizedRoi)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="roster-detail-note">No historical wins available.</p>
          )}
        </section>
      </div>
    </article>
  );
}
