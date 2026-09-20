import { Copy, Heart, Sparkles, Trophy } from "lucide-react";
import type { WalletProfile } from "../types";
import {
  multiple,
  percent,
  shortAddress,
  signedMoney,
} from "../utils/formatters";
export function ProfileArt({
  seed = 0,
  small = false,
}: {
  seed?: number;
  small?: boolean;
}) {
  return (
    <div
      className={`profile-art art-${seed % 4} ${small ? "small-art" : ""}`}
      aria-hidden="true"
    >
      <div className="art-orbit" />
      <div className="art-orbit second" />
      <div className="heart-sculpture">
        <Heart fill="currentColor" strokeWidth={0} />
      </div>
      {!small && (
        <>
          <Sparkles className="art-sparkle one" size={24} />
          <Sparkles className="art-sparkle two" size={16} />
        </>
      )}
    </div>
  );
}
export function SwipeCard({
  wallet,
  index,
  onCopy,
}: {
  wallet: WalletProfile;
  index: number;
  onCopy: (address: string) => void;
}) {
  return (
    <article
      className="wallet-card"
      aria-label={`Wallet profile ${shortAddress(wallet.address)}`}
    >
      <div className="profile-cover">
        <ProfileArt seed={index} />
        <span className="cover-tag">
          <span /> ACTIVE IN 24H BEFORE DISCOVERY
        </span>
      </div>
      <div className="profile-body">
        <div className="wallet-heading">
          <h2>{shortAddress(wallet.address)}</h2>
          <button
            className="wallet-copy"
            aria-label={`Copy wallet address ${wallet.address}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onCopy(wallet.address)}
          >
            <Copy size={14} />
          </button>
        </div>
        <p className="wallet-label">{wallet.label || "Smart money wallet"}</p>
        <div className="profile-stats">
          <div>
            <span>WIN RATE</span>
            <strong>{percent(wallet.winRate)}</strong>
          </div>
          <div>
            <span>REALIZED P&amp;L</span>
            <strong className={wallet.realizedPnlUsd >= 0 ? "profit" : "loss"}>
              {signedMoney(wallet.realizedPnlUsd, true)}
            </strong>
          </div>
        </div>
        <section className="hits-section">
          <div className="section-label">
            <Trophy size={14} />
            <h3>Greatest Hits</h3>
          </div>
          {wallet.topTokens.length ? (
            <div className="trophies">
              {wallet.topTokens.slice(0, 3).map((token) => (
                <div className="trophy" key={token.address}>
                  <span>{token.symbol}</span>
                  <strong>{multiple(token.realizedRoi)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">
              Their best chapter is still unwritten.
            </p>
          )}
        </section>
        <section className="holdings-section">
          <div className="section-label">
            <Heart size={14} />
            <h3>Currently Into</h3>
          </div>
          <div className="token-chips">
            {wallet.currentHoldings.slice(0, 4).map((t) => (
              <span className="token-chip" key={t.address}>
                {t.symbol}
              </span>
            ))}
            {!wallet.currentHoldings.length && (
              <span className="muted small">
                {wallet.holdingsAvailable
                  ? "Keeping their options open."
                  : "Current bags unavailable."}
              </span>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}
