import { Copy } from "lucide-react";
import type { Signal } from "../types";
import {
  cleanTokenSymbol,
  money,
  relativeTime,
  shortAddress,
} from "../utils/formatters";
import { DEFAULT_DEX_URL } from "../utils/constants";
import { dexLink } from "../services/signals";
const contexts = {
  new_position: "New position",
  adding: "Adding more",
  taking_profit: "Reducing position",
  full_exit: "Full exit",
  unknown: "I don't know actually…",
};
export function SignalCard({
  signal: s,
  demo,
  nickname,
  onCopy,
}: {
  signal: Signal;
  demo: boolean;
  nickname?: string;
  onCopy: (text: string) => void;
}) {
  const url = !demo
    ? dexLink(
        import.meta.env.VITE_ROBINHOOD_DEX_URL || DEFAULT_DEX_URL,
        s.tokenAddress,
      )
    : null;
  const tokenSymbol = cleanTokenSymbol(s.tokenSymbol);
  return (
    <article className="signal-card">
      <div className="signal-who">
        <div className="signal-who-text">
          {nickname ? (
            <>
              <strong className="signal-display-name" title={nickname}>
                {nickname}
              </strong>
              <div className="roster-address-line signal-address-line">
                <p className="roster-wallet-address" title={s.walletAddress}>
                  {shortAddress(s.walletAddress)}
                </p>
                <button
                  className="roster-inline-copy"
                  onClick={() => onCopy(s.walletAddress)}
                  aria-label={`Copy wallet address ${s.walletAddress}`}
                  title={s.walletAddress}
                >
                  <Copy size={13} />
                </button>
              </div>
            </>
          ) : (
            <div className="roster-address-line signal-address-line">
              <strong title={s.walletAddress}>
                {shortAddress(s.walletAddress)}
              </strong>
              <button
                className="roster-inline-copy"
                onClick={() => onCopy(s.walletAddress)}
                aria-label={`Copy wallet address ${s.walletAddress}`}
                title={s.walletAddress}
              >
                <Copy size={13} />
              </button>
            </div>
          )}
          <span className="signal-nansen-label">
            {s.walletLabel || "Your match"}
          </span>
        </div>
        <time dateTime={s.timestamp}>{relativeTime(s.timestamp)}</time>
      </div>
      <div className="trade-main">
        <div className="trade-token">
          <span className={`signal-action-pill ${s.action}`}>
            {s.action === "buy" ? "Bought" : "Sold"}
          </span>
          <h3>{tokenSymbol}</h3>
        </div>
        <div className="trade-amount">
          <strong>
            {s.amountUsd === null ? "Unavailable" : money(s.amountUsd)}
          </strong>
          <span>
            {s.quantity === null
              ? "Quantity unavailable"
              : `${new Intl.NumberFormat("en", { maximumFractionDigits: 4 }).format(s.quantity)} ${tokenSymbol}`}
          </span>
        </div>
      </div>
      <div className="signal-context">
        <span className={`context-badge ${s.action}`}>
          Looks like… {contexts[s.contextBadge]}
        </span>
        {url ? (
          <a
            className="copy-address token-fomo-link"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${tokenSymbol} on Fomo`}
          >
            View on Fomo
          </a>
        ) : null}
      </div>
    </article>
  );
}
