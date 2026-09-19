import type { Mode, Theme } from "../types";

export function SettingsMenu({
  mode,
  theme,
  onModeChange,
  onThemeChange,
}: {
  mode: Mode;
  theme: Theme;
  onModeChange: (mode: Mode) => void;
  onThemeChange: (theme: Theme) => void;
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
      <div className="settings-row">
        <div className="settings-row-copy">
          <p className="settings-label">Interface</p>
          <p className="settings-hint">Light paper or dark night mode.</p>
        </div>
        <div className="segmented" role="group" aria-label="Interface theme">
          <button
            type="button"
            className={theme === "light" ? "segment active" : "segment"}
            aria-pressed={theme === "light"}
            onClick={() => onThemeChange("light")}
          >
            Light
          </button>
          <button
            type="button"
            className={theme === "dark" ? "segment active" : "segment"}
            aria-pressed={theme === "dark"}
            onClick={() => onThemeChange("dark")}
          >
            Dark
          </button>
        </div>
      </div>
    </div>
  );
}
