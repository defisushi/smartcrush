/** Strip emoji / pictographs so tickers stay readable. */
export const cleanTokenSymbol = (symbol: string) => {
  const cleaned = symbol
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Unknown";
};
export const shortAddress = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`;
export const money = (v: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    ...(compact
      ? { notation: "compact" as const, maximumFractionDigits: 1 }
      : {}),
  }).format(v);
export const signedMoney = (v: number, compact = false) =>
  `${v >= 0 ? "+" : "−"}${money(Math.abs(v), compact)}`;
export const percent = (v: number) => `${Math.round(v * 100)}%`;
export const multiple = (v: number | null) =>
  v === null ? "—" : `${Number(v.toFixed(1))}×`;
export const relativeTime = (date: string | number, now = Date.now()) => {
  const mins = Math.max(
    0,
    Math.floor((now - new Date(date).getTime()) / 60000),
  );
  return mins < 1
    ? "just now"
    : mins < 60
      ? `${mins}m ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ago`
        : `${Math.floor(mins / 1440)}d ago`;
};
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const matchTime = (date: string | number, now = Date.now()) => {
  const matched = new Date(date);
  const current = new Date(now);
  const isToday =
    matched.getFullYear() === current.getFullYear() &&
    matched.getMonth() === current.getMonth() &&
    matched.getDate() === current.getDate();

  if (isToday) return relativeTime(date, now);

  return `${String(matched.getDate()).padStart(2, "0")} ${SHORT_MONTHS[matched.getMonth()]} ${String(matched.getFullYear()).slice(-2)}`;
};
export const countdown = (
  until: number,
  now = Date.now(),
  showSeconds = false,
) => {
  if (showSeconds) {
    const totalSeconds = Math.max(0, Math.ceil((until - now) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  const minutes = Math.max(0, Math.ceil((until - now) / 60000));
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
};
