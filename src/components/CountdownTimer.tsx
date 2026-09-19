import { useEffect, useState } from "react";
import { countdown } from "../utils/formatters";
export function CountdownTimer({
  until,
  showSeconds = false,
}: {
  until: number;
  showSeconds?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(
      () => setNow(Date.now()),
      showSeconds ? 1000 : 10000,
    );
    return () => clearInterval(id);
  }, [showSeconds]);
  return <span>{countdown(until, now, showSeconds)}</span>;
}
