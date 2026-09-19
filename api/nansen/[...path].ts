import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const segments = req.query.path;
  const path = Array.isArray(segments) ? segments.join("/") : segments || "";
  const target = `https://api.nansen.ai/${path}`;

  // Use the client's own key if they entered one; otherwise fall back to the
  // server-side secret so the key never appears in the frontend bundle.
  const clientKey = req.headers["apikey"] as string | undefined;
  const apiKey = clientKey || process.env.NANSEN_API_KEY || "";

  if (!apiKey) {
    return res
      .status(401)
      .json({ error: "No API key configured on the server." });
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }

  try {
    const upstream = await fetch(target, {
      method: req.method || "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body:
        req.method !== "GET" && req.method !== "HEAD"
          ? JSON.stringify(req.body)
          : undefined,
    });

    // Forward rate-limit headers so the client's retry logic works.
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) res.setHeader("Retry-After", retryAfter);

    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json",
    );
    const data = await upstream.text();
    return res.status(upstream.status).send(data);
  } catch {
    return res.status(502).json({ error: "Failed to reach Nansen API." });
  }
}
