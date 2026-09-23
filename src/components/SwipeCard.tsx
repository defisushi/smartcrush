import { useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Copy, Heart, Sparkles, Trophy } from "lucide-react";
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
function WalletHeading({
  wallet,
  onCopy,
}: {
  wallet: WalletProfile;
  onCopy: (address: string) => void;
}) {
  return (
    <>
      <div className="wallet-heading">
        <h2>{shortAddress(wallet.address)}</h2>
        <button
          className="wallet-copy"
          aria-label={`Copy wallet address ${wallet.address}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onCopy(wallet.address);
          }}
        >
          <Copy size={14} />
        </button>
      </div>
      <p className="wallet-label">{wallet.label || "Smart money wallet"}</p>
    </>
  );
}

function GreatestHits({ wallet }: { wallet: WalletProfile }) {
  return (
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
        <p className="muted small">Their best chapter is still unwritten.</p>
      )}
    </section>
  );
}

export function SwipeCard({
  wallet,
  index,
  onCopy,
  expanded = false,
  onExpand,
  onCollapse,
}: {
  wallet: WalletProfile;
  index: number;
  onCopy: (address: string) => void;
  expanded?: boolean;
  onExpand?: (fromKeyboard?: boolean) => void;
  onCollapse?: () => void;
}) {
  const profileId = useId();
  const expandButton = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  return (
    <>
      <article
        className="wallet-card"
        aria-label={`Wallet profile ${shortAddress(wallet.address)}`}
        inert={expanded}
        onClick={() => onExpand?.()}
      >
        <div className="profile-cover">
          <ProfileArt seed={index} />
          <span className="cover-tag">
            <span /> ACTIVE IN 24H BEFORE DISCOVERY
          </span>
          <div className="cover-wallet-info">
            <WalletHeading wallet={wallet} onCopy={onCopy} />
          </div>
        </div>
        <div className="profile-body">
          <GreatestHits wallet={wallet} />
          <button
            ref={expandButton}
            className="tap-hint"
            aria-expanded={expanded}
            aria-controls={expanded ? profileId : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onExpand?.(event.detail === 0);
            }}
          >
            Tap to see full profile <ChevronDown size={12} />
          </button>
        </div>
      </article>
      <AnimatePresence
        onExitComplete={() =>
          expandButton.current?.focus({ preventScroll: true })
        }
      >
        {expanded && (
          <motion.div
            id={profileId}
            className="wallet-profile-expanded"
            role="region"
            aria-label={`Full profile ${shortAddress(wallet.address)}`}
            initial={{ opacity: 0, y: reduced ? 0 : 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 40 }}
            transition={{ duration: reduced ? 0 : 0.22 }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                onCollapse?.();
              }
            }}
          >
            <div className="expanded-header">
              <div className="expanded-identity">
                <WalletHeading wallet={wallet} onCopy={onCopy} />
              </div>
              <button
                className="expanded-close"
                aria-label="Close full profile"
                autoFocus
                onClick={onCollapse}
              >
                <ChevronDown size={22} />
              </button>
            </div>
            <div
              className="expanded-body"
              tabIndex={0}
              aria-label="Profile details"
            >
              <div className="profile-stats">
                <div>
                  <span>WIN RATE</span>
                  <strong>{percent(wallet.winRate)}</strong>
                </div>
                <div>
                  <span>REALIZED P&amp;L</span>
                  <strong
                    className={wallet.realizedPnlUsd >= 0 ? "profit" : "loss"}
                  >
                    {signedMoney(wallet.realizedPnlUsd, true)}
                  </strong>
                </div>
              </div>
              <section className="holdings-section">
                <div className="section-label">
                  <Heart size={14} />
                  <h3>Currently Into</h3>
                </div>
                <div className="token-chips">
                  {wallet.currentHoldings.slice(0, 4).map((token) => (
                    <span className="token-chip" key={token.address}>
                      {token.symbol}
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
