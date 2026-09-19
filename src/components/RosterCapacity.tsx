import { UserRound } from "lucide-react";

export function RosterCapacity({
  count,
  showExplanation = true,
}: {
  count: number;
  showExplanation?: boolean;
}) {
  return (
    <div className="scout-roster-note">
      <span className="scout-roster-count">Roster: {count}/10</span>
      <div
        className="roster-capacity"
        aria-label={`${count} of 10 roster spots filled`}
      >
        {Array.from({ length: 10 }, (_, index) => (
          <UserRound
            aria-hidden="true"
            className={index < count ? "filled" : ""}
            key={index}
            size={19}
            strokeWidth={1.7}
          />
        ))}
      </div>
      {showExplanation && (
        <small>You may have a roster of up to 10 Smartcrushes.</small>
      )}
    </div>
  );
}
