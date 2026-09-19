import type { ReactNode } from "react";
import type { Theme } from "../types";

export function AppFrame({
  children,
  theme = "light",
}: {
  children: ReactNode;
  theme?: Theme;
}) {
  return (
    <div className="app-frame" data-theme={theme}>
      {children}
    </div>
  );
}
