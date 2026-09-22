import { useState } from "react";
import {
  ArrowRight,
  KeyRound,
  Heart,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { ProfileArt } from "./SwipeCard";
export function Connection({
  onConnect,
  onDemo,
  onConfiguredConnect,
}: {
  onConnect: (key: string) => void;
  onDemo: () => void;
  onConfiguredConnect?: () => void;
}) {
  const [key, setKey] = useState(""),
    [visible, setVisible] = useState(false);
  return (
    <div className="connection">
      <div className="onboarding-art">
        <ProfileArt />
        <span className="onboarding-sticker">
          <Sparkles size={14} /> HIGH STANDARDS. HIGHER UPSIDE.
        </span>
      </div>
      <p className="eyebrow">SMART MONEY. REAL CHEMISTRY.</p>
      <h1>
        Find your
        <br />
        <em>onchain type.</em>
      </h1>
      <p className="intro-copy">
        Meet the wallets with a track record.
        <br />
        Keep the ones that make your heart pump.
      </p>
      <div className="onboarding-steps">
        <span>
          <b>01</b> Swipe
        </span>
        <i>→</i>
        <span>
          <b>02</b> Match
        </span>
        <i>→</i>
        <span>
          <b>03</b> Follow
        </span>
      </div>
      {onConfiguredConnect && (
        <button
          className="button primary configured-connect"
          onClick={onConfiguredConnect}
        >
          <KeyRound size={16} /> Use project API key
        </button>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (key.trim()) {
            onConnect(key);
            setKey("");
          }
        }}
      >
        <label htmlFor="api-key">
          <KeyRound size={14} /> Your Nansen API key
        </label>
        <div className="key-field">
          <input
            id="api-key"
            type={visible ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="A little key to a lot of chemistry"
            autoComplete="off"
            spellCheck={false}
            required
          />
          <button
            type="button"
            aria-label={visible ? "Hide API key" : "Show API key"}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="key-note">
          Your key stays in memory for this visit and goes directly to Nansen.
        </p>
        <button className="button primary" disabled={!key.trim()} type="submit">
          Let’s find your type <ArrowRight size={17} />
        </button>
      </form>
      <button className="button demo-button" onClick={onDemo}>
        <Heart size={16} /> Take a peek with demo wallets
      </button>
      <p className="demo-disclosure">
        Demo mode uses fictional wallets and sample trades.
      </p>
    </div>
  );
}
