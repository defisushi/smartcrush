import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  // In dev: load the backend key for the local proxy.
  // In production builds: the Vercel serverless function handles proxying,
  // so the proxy flag is always on and no key touches the frontend.
  const projectKey =
    command === "serve" && mode !== "test"
      ? loadEnv(mode, "./backend", "NANSEN_").NANSEN_API_KEY
      : undefined;

  // Proxy is available whenever we're building for production OR a dev key
  // is configured. This controls whether the frontend hits /api/nansen/...
  // (proxied) or tries to call Nansen directly (CORS-blocked).
  const useProxy = command === "build" || Boolean(projectKey);

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_NANSEN_PROXY": JSON.stringify(useProxy),
      ...(mode === "test"
        ? { "import.meta.env.VITE_NANSEN_PROXY": JSON.stringify(false) }
        : {}),
    },
    server: {
      port: 5173,
      strictPort: true,
      ...(projectKey
        ? {
            proxy: {
              "^/api/nansen/api/v1/(smart-money/dex-trades|profiler/address/(pnl-summary|pnl))$":
                {
                  target: "https://api.nansen.ai",
                  changeOrigin: true,
                  rewrite: (path: string) => path.replace(/^\/api\/nansen/, ""),
                  configure: (proxy) => {
                    proxy.on("proxyReq", (request, incoming) => {
                      request.setHeader(
                        "apikey",
                        incoming.headers.apikey || projectKey,
                      );
                      request.removeHeader("origin");
                    });
                  },
                },
            },
          }
        : {}),
    },
  };
});
