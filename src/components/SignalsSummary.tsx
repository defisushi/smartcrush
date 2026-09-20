import { Copy } from "lucide-react";
import type { Signal } from "../types";
import { cleanTokenSymbol, money, shortAddress } from "../utils/formatters";
import {
  buildSignalsSummary,
  summaryHasRows,
  type TokenSummaryRow,
} from "../utils/signalSummary";

function Section({
  title,
  hint,
  rows,
  metric,
  onCopy,
}: {
  title: string;
  hint: string;
  rows: TokenSummaryRow[];
  metric: "net" | "overlap";
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
        {rows.map((row, index) => (
          <li key={`${metric}-${row.tokenAddress}`}>
            <span className="signals-summary-rank">{index + 1}</span>
            <div className="signals-summary-token">
              <strong>{cleanTokenSymbol(row.tokenSymbol)}</strong>
              <button
                className="roster-inline-copy"
                onClick={() => onCopy(row.tokenAddress)}
                aria-label={`Copy ${cleanTokenSymbol(row.tokenSymbol)} token address`}
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
        ))}
      </ol>
    </section>
  );
}

export function SignalsSummary({
  signals,
  onCopy,
}: {
  signals: Signal[];
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
          onCopy={onCopy}
        />
        <Section
          title="Top Net Sells"
          hint="Highest sell volume minus buys"
          rows={summary.topNetSells}
          metric="net"
          onCopy={onCopy}
        />
        <Section
          title="Top Shared Buys"
          hint="Most Smartcrushes buying the same token"
          rows={summary.topBuyOverlap}
          metric="overlap"
          onCopy={onCopy}
        />
        <Section
          title="Top Shared Sells"
          hint="Most Smartcrushes selling the same token"
          rows={summary.topSellOverlap}
          metric="overlap"
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
