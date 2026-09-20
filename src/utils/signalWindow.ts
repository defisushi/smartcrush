import type { Signal } from "../types";
import { DAY_MS } from "./constants";

export function recentSignals(signals: Signal[], now = Date.now()) {
  return signals.filter((signal) => {
    const at = Date.parse(signal.timestamp);
    return Number.isFinite(at) && at > now - DAY_MS && at <= now;
  });
}
