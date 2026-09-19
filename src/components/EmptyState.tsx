import { Heart, Hourglass, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
export function EmptyState({
  title,
  children,
  action,
  onAction,
  icon = "heart",
}: {
  title: string;
  children: ReactNode;
  action?: string;
  onAction?: () => void;
  icon?: "heart" | "hourglass";
}) {
  return (
    <div className="empty-state">
      <div className={`empty-art ${icon === "hourglass" ? "waiting" : ""}`}>
        {icon === "hourglass" ? (
          <Hourglass size={46} strokeWidth={1.4} />
        ) : (
          <>
            <Heart size={46} strokeWidth={1.4} />
            <Sparkles size={22} />
          </>
        )}
      </div>
      <h2>{title}</h2>
      <div className="empty-copy">{children}</div>
      {action && (
        <button className="button primary" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
