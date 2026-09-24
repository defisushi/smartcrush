import { Heart } from "lucide-react";
export function SkeletonCard({
  label = "Finding your type…",
  compact = false,
  progress,
  progressMax = 20,
}: {
  label?: string;
  compact?: boolean;
  progress?: number;
  progressMax?: number;
}) {
  const showHeart = !compact && typeof progress === "number" && progressMax > 0;
  const pct = showHeart
    ? Math.max(0, Math.min(100, (progress / progressMax) * 100))
    : 0;
  return (
    <div
      className={`skeleton-card ${compact ? "compact" : ""} ${showHeart ? "match-search" : ""}`}
      role="status"
      aria-label={label}
      aria-valuemin={showHeart ? 0 : undefined}
      aria-valuemax={showHeart ? progressMax : undefined}
      aria-valuenow={showHeart ? progress : undefined}
    >
      {!showHeart && (
        <>
          <div className="skeleton hero" />
          <div className="skeleton line" />
          <div className="skeleton line short" />
          <div className="skeleton block" />
        </>
      )}
      {showHeart && (
        <>
          <p className="loading-wait">Please wait...</p>
          <div className="loading-heart" aria-hidden="true">
            <Heart className="loading-heart-empty" strokeWidth={1.75} />
            <div
              className="loading-heart-fill-clip"
              style={{ clipPath: `inset(${100 - pct}% 0 0 0)` }}
            >
              <Heart
                className="loading-heart-full"
                strokeWidth={1.75}
                fill="currentColor"
              />
            </div>
          </div>
        </>
      )}
      <p>{label}</p>
    </div>
  );
}
