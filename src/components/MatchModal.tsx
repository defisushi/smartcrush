import { Heart } from "lucide-react";
import type { CSSProperties } from "react";
import type { WalletProfile } from "../types";
import { percent, shortAddress, signedMoney } from "../utils/formatters";
import { Modal } from "./Modal";

const confetti = [
  [-142, -78, -290, 0, "#f36959"],
  [-119, -125, -220, 35, "#d9a847"],
  [-96, -58, 260, 70, "#73915e"],
  [-73, -148, -180, 15, "#eb9277"],
  [-51, -92, 310, 85, "#9b85b6"],
  [-28, -135, -250, 45, "#f4bd64"],
  [-9, -72, 210, 95, "#ef6b5d"],
  [15, -151, -320, 20, "#7d9c68"],
  [36, -103, 280, 65, "#e09f49"],
  [58, -139, -230, 0, "#e9806e"],
  [82, -77, 300, 90, "#9c88bd"],
  [106, -123, -270, 30, "#f3b958"],
  [131, -67, 240, 75, "#f36959"],
  [148, -108, -300, 45, "#789663"],
  [-131, -31, 210, 105, "#e8a03e"],
  [-66, -41, -260, 120, "#ef7665"],
  [-20, -46, 280, 55, "#8b77aa"],
  [27, -34, -210, 110, "#e7ad4d"],
  [75, -49, 260, 25, "#6f8e5b"],
  [124, -38, -280, 95, "#f36959"],
] as const;

export function MatchModal({
  wallet,
  onClose,
}: {
  wallet: WalletProfile;
  onClose: () => void;
}) {
  return (
    <Modal title="It’s a Match!" onClose={onClose} className="match-modal">
      <div className="match-confetti" aria-hidden="true">
        {confetti.map(([x, y, rotation, delay, color], index) => (
          <span
            key={index}
            style={
              {
                "--confetti-x": `${x}px`,
                "--confetti-y": `${y}px`,
                "--confetti-rotation": `${rotation}deg`,
                "--confetti-delay": `${delay}ms`,
                "--confetti-color": color,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="match-modal-symbol" aria-hidden="true">
        <Heart size={38} fill="currentColor" />
      </div>
      <p className="match-modal-copy">
        Smartcrush <strong>{shortAddress(wallet.address)}</strong> is now on
        your roster.
      </p>
      <div className="match-modal-stats">
        <div>
          <span>Win Rate</span>
          <strong>{percent(wallet.winRate)}</strong>
        </div>
        <div>
          <span>Realized P&amp;L</span>
          <strong className={wallet.realizedPnlUsd >= 0 ? "profit" : "loss"}>
            {signedMoney(wallet.realizedPnlUsd, true)}
          </strong>
        </div>
      </div>
      <div className="match-modal-holdings">
        <h3>Currently Into</h3>
        {wallet.currentHoldings.length ? (
          <div className="token-chips">
            {wallet.currentHoldings.slice(0, 6).map((holding) => (
              <span className="token-chip" key={holding.address}>
                {holding.symbol}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted small">
            {wallet.holdingsAvailable
              ? "Keeping their options open."
              : "Current holdings unavailable."}
          </p>
        )}
      </div>
      <button className="button primary" onClick={onClose}>
        Keep swiping
      </button>
    </Modal>
  );
}
