import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { Mode } from "../types";

export function SettingsMenu({
  mode,
  onModeChange,
  onSaveApiKey,
}: {
  mode: Mode;
  onModeChange: (mode: Mode, key?: string) => void;
  onSaveApiKey: (key: string) => void;
}) {
  const [key, setKey] = useState(""),
    [visible, setVisible] = useState(false);
  const trimmed = key.trim();
  const apiDisabled = mode === "demo";

  return (
    <div className="settings-menu">
      <div className="settings-row">
        <div className="segmented" role="group" aria-label="Data mode">
          <button
            type="button"
            className={mode === "live" ? "segment active" : "segment"}
            aria-pressed={mode === "live"}
            onClick={() => onModeChange("live", trimmed)}
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

      <div
        className={
          apiDisabled
            ? "settings-row settings-api-key is-disabled"
            : "settings-row settings-api-key"
        }
      >
        <div className="settings-row-copy">
          <p className="settings-label">Nansen API Key</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (apiDisabled || !trimmed) return;
            onSaveApiKey(trimmed);
            setKey("");
          }}
        >
          <div className="key-field">
            <input
              id="settings-api-key"
              type={visible ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label="Nansen API Key"
              disabled={apiDisabled}
            />
            <button
              type="button"
              aria-label={visible ? "Hide API key" : "Show API key"}
              onClick={() => setVisible(!visible)}
              disabled={apiDisabled}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="key-note">Be careful with your API key.</p>
          <button
            className="button primary"
            disabled={apiDisabled || !trimmed}
            type="submit"
          >
            Save API key
          </button>
        </form>
      </div>
    </div>
  );
}
