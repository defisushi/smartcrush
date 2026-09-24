import { Copy } from "lucide-react";
import type { Signal } from "../types";
import { cleanTokenSymbol, money, shortAddress } from "../utils/formatters";
import {
  buildSignalsSummary,
  summaryHasRows,
  type TokenSummaryRow,
} from "../utils/signalSummary";
import { DEFAULT_DEX_URL } from "../utils/constants";
import { dexLink } from "../services/signals";

function tokenFomoUrl(tokenAddress: string | undefined, demo: boolean) {
  if (demo || !tokenAddress) return null;
  return dexLink(
    import.meta.env.VITE_ROBINHOOD_DEX_URL || DEFAULT_DEX_URL,
    tokenAddress,
  );
}

function Section({
  title,
  hint,
  rows,
  metric,
  demo,
  onCopy,
}: {
  title: string;
  hint: string;
  rows: TokenSummaryRow[];
  metric: "net" | "overlap";
  demo: boolean;
  onCopy: (text: string) => void;
}) {
  if (!rows.length) return null;
  return (
    <section className="signals-summary-section">
      <div className="signals-summary-section-head">
        <h3>{title}</h3>
        <p>{hint}</p>
      </div>
      <ol className="signals-summary-list">
        {rows.map((row, index) => {
          const symbol = cleanTokenSymbol(row.tokenSymbol);
          const url = tokenFomoUrl(row.tokenAddress, demo);
          return (
            <li key={`${metric}-${row.tokenAddress}`}>
              <span className="signals-summary-rank">{index + 1}</span>
              <div className="signals-summary-token">
                <strong>
                  {url ? (
                    <a
                      className="token-fomo-name"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${symbol} on Fomo`}
                    >
                      {symbol}
                    </a>
                  ) : (
                    symbol
                  )}
                </strong>
                <button
                  className="roster-inline-copy"
                  onClick={() => onCopy(row.tokenAddress)}
                  aria-label={`Copy ${symbol} token address`}
                  title={row.tokenAddress}
                >
                  {shortAddress(row.tokenAddress)} <Copy size={12} />
                </button>
              </div>
              <div className="signals-summary-metric">
                {metric === "net" ? (
                  <strong>
                    {row.volumeUsd === null
                      ? "Unavailable"
                      : money(row.volumeUsd, true)}
                  </strong>
                ) : (
                  <>
                    <strong>
                      {row.walletCount}{" "}
                      {row.walletCount === 1 ? "Smartcrush" : "Smartcrushes"}
                    </strong>
                    <span>
                      {row.volumeUsd === null
                        ? "Unavailable"
                        : `${money(row.volumeUsd, true)} volume`}
                    </span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function SignalsSummary({
  signals,
  demo,
  onCopy,
}: {
  signals: Signal[];
  demo: boolean;
  onCopy: (text: string) => void;
}) {
  const summary = buildSignalsSummary(signals);
  const incomplete = signals.some((s) => s.amountUsd === null);
  if (!summaryHasRows(summary) && !incomplete) return null;
  return (
    <div className="signals-summary">
      <div className="signals-summary-grid">
        <Section
          title="Top Net Buys"
          hint="Highest buy volume minus sells"
          rows={summary.topNetBuys}
          metric="net"
          demo={demo}
          onCopy={onCopy}
        />
        <Section
          title="Top Net Sells"
          hint="Highest sell volume minus buys"
          rows={summary.topNetSells}
          metric="net"
          demo={demo}
          onCopy={onCopy}
        />
        <Section
          title="Top Shared Buys"
          hint="Most Smartcrushes buying the same token"
          rows={summary.topBuyOverlap}
          metric="overlap"
          demo={demo}
          onCopy={onCopy}
        />
        <Section
          title="Top Shared Sells"
          hint="Most Smartcrushes selling the same token"
          rows={summary.topSellOverlap}
          metric="overlap"
          demo={demo}
          onCopy={onCopy}
        />
      </div>
      {incomplete && (
        <p className="footnote">
          Net rankings exclude tokens with unavailable trade values.
        </p>
      )}
    </div>
  );
}
