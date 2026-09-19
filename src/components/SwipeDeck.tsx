import { useState } from "react";
import {
  motion,
  useAnimationControls,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { ArrowLeft, ArrowRight, Heart, X } from "lucide-react";
import type { SessionData } from "../types";
import { SwipeCard } from "./SwipeCard";
import { EmptyState } from "./EmptyState";
import { CountdownTimer } from "./CountdownTimer";
import { SkeletonCard } from "./SkeletonCard";
function DraggableCard({
  data,
  onSwipe,
  onFull,
  onCopy,
}: {
  data: SessionData;
  onSwipe: (d: "left" | "right") => void;
  onFull: () => void;
  onCopy: (address: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const x = useMotionValue(0),
    rotate = useTransform(x, [-200, 0, 200], [-13, 0, 13]);
  const passOpacity = useTransform(x, [-90, -20], [1, 0]),
    matchOpacity = useTransform(x, [20, 90], [0, 1]);
  const controls = useAnimationControls(),
    reduced = useReducedMotion();
  const doSwipe = async (direction: "left" | "right") => {
    if (busy) return;
    if (direction === "right" && data.roster.length >= 10) {
      void controls.start({ x: 0, rotate: 0 });
      onFull();
      return;
    }
    setBusy(true);
    await controls.start({
      x: direction === "left" ? -520 : 520,
      opacity: 0,
      transition: { duration: reduced ? 0 : 0.28 },
    });
    onSwipe(direction);
  };
  return (
    <>
      <div className="card-stack">
        <div className="behind-card" />
        <motion.div
          className="draggable-card"
          style={{ x, rotate, touchAction: "pan-y" }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.85}
          dragMomentum={false}
          animate={controls}
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 85)
              void doSwipe(info.offset.x > 0 ? "right" : "left");
            else void controls.start({ x: 0 });
          }}
        >
          <SwipeCard
            wallet={data.deck[data.deckPosition]}
            index={data.deckPosition}
            onCopy={onCopy}
          />
          <motion.div
            className="swipe-stamp pass-stamp"
            style={{ opacity: passOpacity }}
          >
            PASS
          </motion.div>
          <motion.div
            className="swipe-stamp match-stamp"
            style={{ opacity: matchOpacity }}
          >
            MATCH ♥
          </motion.div>
        </motion.div>
      </div>
      <div className="swipe-actions">
        <span>
          <ArrowLeft size={12} /> NOT MY TYPE
        </span>
        <button
          className="swipe-button pass-button"
          aria-label="Pass on this wallet"
          disabled={busy}
          onClick={() => void doSwipe("left")}
        >
          <X size={27} />
        </button>
        <button
          className="swipe-button match-button"
          aria-label="Match with this wallet"
          disabled={busy}
          onClick={() => void doSwipe("right")}
        >
          <Heart size={27} fill="currentColor" />
        </button>
        <span>
          MY TYPE <ArrowRight size={12} />
        </span>
      </div>
    </>
  );
}
export function SwipeDeck({
  data,
  loading,
  progress,
  onSwipe,
  onFull,
  onCopy,
}: {
  data: SessionData;
  loading: boolean;
  progress: number;
  onSwipe: (d: "left" | "right") => void;
  onFull: () => void;
  onCopy: (address: string) => void;
}) {
  if (loading)
    return (
      <SkeletonCard
        progress={progress}
        progressMax={20}
        label={
          progress
            ? `Getting to know your prospects… ${progress} / 20`
            : "Looking for a little onchain chemistry…"
        }
      />
    );
  if (!data.deck.length)
    return (
      <EmptyState title="A little quiet out here.">
        <p>
          No smart money spotted on Robinhood chain right now, or you’ve already
          met today’s available prospects.
        </p>
        <p>
          New prospects in <CountdownTimer until={data.deckRefreshAt} />.
        </p>
      </EmptyState>
    );
  if (data.deckPosition >= data.deck.length)
    return (
      <EmptyState title="You’ve met everyone. For now." icon="hourglass">
        <p>
          That’s your 20 Smartcrushes this session.
          <br />
          Come back later to meet fresh faces!
        </p>
        <div className="countdown-large">
          <CountdownTimer until={data.deckRefreshAt} showSeconds />
        </div>
      </EmptyState>
    );
  return (
    <>
      <div className="deck-meta">
        <span>This Session’s Smartcrushes</span>
        <span>
          <strong>{data.deckPosition + 1}</strong> of {data.deck.length}
        </span>
      </div>
      <DraggableCard
        key={data.deck[data.deckPosition].address}
        data={data}
        onSwipe={onSwipe}
        onFull={onFull}
        onCopy={onCopy}
      />
    </>
  );
}
