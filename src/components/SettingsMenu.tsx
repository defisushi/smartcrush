import type { Mode } from "../types";

export function SettingsMenu({
  mode,
  onModeChange,
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}) {
  return (
    <div className="settings-menu">
      <div className="settings-row">
        <div className="settings-row-copy">
          <p className="settings-label">Data</p>
          <p className="settings-hint">Live Nansen feeds or sample wallets.</p>
        </div>
        <div className="segmented" role="group" aria-label="Data mode">
          <button
            type="button"
            className={mode === "live" ? "segment active" : "segment"}
            aria-pressed={mode === "live"}
            onClick={() => onModeChange("live")}
          >
            LIVE DATA
          </button>
          <button
            type="button"
            className={mode === "demo" ? "segment active" : "segment"}
            aria-pressed={mode === "demo"}
            onClick={() => onModeChange("demo")}
          >
            DEMO MODE
          </button>
        </div>
      </div>
    </div>
  );
}
