import { ArrowRight, Heart } from "lucide-react";

const STEPS = [
  "Swipe on 20 Smart Money wallets every 4 hours",
  "Curate and maintain a roster of up to 10 favorites",
  "Observe their signals and follow their trades",
] as const;

export function Welcome({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="welcome">
      <div className="welcome-brand" aria-label="Smartcrush">
        <span className="brand-mark welcome-mark">
          <Heart size={30} fill="currentColor" strokeWidth={0} />
        </span>
        <span className="brand-wordmark welcome-wordmark">
          Smart<span>crush</span>
          <i>™</i>
        </span>
      </div>
      <p className="welcome-tagline">
        Dating app. Ish. Find Smart Money wallets on Robinhood Chain. Powered by
        Nansen.
      </p>
      <p className="welcome-eyebrow">HOW IT WORKS</p>
      <ol className="welcome-steps">
        {STEPS.map((step, i) => (
          <li key={step}>
            <span className="welcome-step-num">{i + 1}</span>
            <span className="welcome-step-copy">{step}</span>
          </li>
        ))}
      </ol>
      <button
        className="button primary welcome-cta"
        type="button"
        onClick={onContinue}
      >
        Enter Smartcrush App <ArrowRight size={18} />
      </button>
      <p className="welcome-footnote">
        Remember... If it's not working out, you can break up with your
        Smartcrush to make room for hotter, better ones!
      </p>
    </div>
  );
}
