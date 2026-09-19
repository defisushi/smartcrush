interface Env {
  NANSEN_API_KEY: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const segments = params.path;
  const path = Array.isArray(segments) ? segments.join("/") : segments || "";
  const target = `https://api.nansen.ai/${path}`;

  // Use the client's own key if they entered one; otherwise fall back to the
  // server-side secret so the key never appears in the frontend bundle.
  const clientKey = request.headers.get("apikey");
  const apiKey = clientKey || env.NANSEN_API_KEY || "";

  if (!apiKey) {
    return Response.json({ error: "No API key configured on the server." }, { status: 401 });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { Allow: "POST, OPTIONS" },
    });
  }

  try {
    const body =
      request.method !== "GET" && request.method !== "HEAD"
        ? await request.text()
        : undefined;

    const upstream = await fetch(target, {
      method: request.method || "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body,
    });

    // Forward rate-limit headers so the client's retry logic works.
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    });
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) headers.set("Retry-After", retryAfter);

    const data = await upstream.text();
    return new Response(data, { status: upstream.status, headers });
  } catch {
    return Response.json({ error: "Failed to reach Nansen API." }, { status: 502 });
  }
};
