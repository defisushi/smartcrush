/** Lightweight SPA path helpers (no react-router). */

export type AppRoute = "welcome" | "app";

/** Strip trailing slashes except for root. `/app/` → `/app`. */
export function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

export function pathToRoute(pathname: string): AppRoute {
  return normalizePathname(pathname) === "/app" ? "app" : "welcome";
}

/**
 * Normalize the address bar once on boot:
 * - `/app/` → `/app`
 * - unknown paths → `/`
 * - drop obsolete `?welcome=1`
 */
export function normalizeLocation(): AppRoute {
  const url = new URL(window.location.href);
  const path = normalizePathname(url.pathname);
  const known = path === "/" || path === "/app";
  let changed = false;

  if (url.searchParams.has("welcome")) {
    url.searchParams.delete("welcome");
    changed = true;
  }
  if (!known) {
    url.pathname = "/";
    changed = true;
  } else if (url.pathname !== path) {
    url.pathname = path;
    changed = true;
  }

  if (changed) {
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  return pathToRoute(url.pathname);
}

export function navigate(to: AppRoute, replace = false): void {
  const path = to === "app" ? "/app" : "/";
  if (normalizePathname(window.location.pathname) === path) return;
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", path);
}
