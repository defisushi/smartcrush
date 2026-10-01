import { afterEach, describe, expect, it, vi } from "vitest";
import { nansenPost, setApiKey } from "../src/services/nansen";
import { onRequest } from "../functions/api/nansen/[[path]]";
import nansenAccess from "../nansen-access.json";

afterEach(() => {
  setApiKey("");
  vi.unstubAllGlobals();
});

describe.skipIf(!nansenAccess.paused)("Nansen operational pause", () => {
  it("blocks client requests before fetch, even with a user key", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    setApiKey("fixture-key");
    await expect(
      nansenPost("/api/v1/smart-money/dex-trades", {}),
    ).rejects.toMatchObject({
      status: 423,
      message: nansenAccess.message,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([undefined, "fixture-client-key"])(
    "blocks hosted proxy requests without contacting Nansen (client key: %s)",
    async (key) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const response = await onRequest({
        request: new Request(
          "https://smartcrush.pages.dev/api/nansen/api/v1/smart-money/dex-trades",
          {
            method: "POST",
            headers: key ? { apikey: key } : {},
            body: "{}",
          },
        ),
        env: { NANSEN_API_KEY: "fixture-project-key" },
        params: { path: ["api", "v1", "smart-money", "dex-trades"] },
      });
      expect(response.status).toBe(423);
      expect(await response.json()).toEqual({
        error: nansenAccess.message,
        paused: true,
      });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
