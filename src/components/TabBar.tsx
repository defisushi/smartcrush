import { Heart, UsersRound, Zap } from "lucide-react";
import type { Tab } from "../types";
export function TabBar({
  tab,
  onChange,
  count,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
  count: number;
}) {
  return (
    <nav className="tab-bar" aria-label="Main navigation">
      {(
        [
          ["swipe", Heart, "Swipe"],
          ["roster", UsersRound, "Roster"],
          ["signals", Zap, "Signals"],
        ] as const
      ).map(([id, Icon, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={tab === id ? "tab active" : "tab"}
          aria-current={tab === id ? "page" : undefined}
        >
          <span className="tab-icon">
            <Icon size={22} />
            {id === "roster" && count > 0 && (
              <span className="tab-count">{count}</span>
            )}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
