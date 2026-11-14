interface Env {
  GOOGLE_TRANSLATE_API_KEY: string;
  ALLOWED_ORIGINS?: string;
  ALLOWED_ORIGIN?: string;
}

interface GoogleTranslationResponse {
  data?: {
    translations?: Array<{ translatedText?: string; detectedSourceLanguage?: string }>;
    languages?: Array<{ language?: string; name?: string }>;
  };
  error?: { message?: string };
}

function getAllowedOrigins(env: Env): string[] {
  const configured = env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "";
  return configured.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function corsHeaders(origin: string, allowedOrigins: string[]) {
  const allowedOrigin = allowedOrigins.includes("*")
    ? "*"
    : (allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] ?? "null"));

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "";
    const allowedOrigins = getAllowedOrigins(env);
    const headers = corsHeaders(origin, allowedOrigins);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (
        origin &&
        allowedOrigins.length &&
        !allowedOrigins.includes("*") &&
        !allowedOrigins.includes(origin)
      ) {
        return new Response(null, { status: 403, headers });
      }
      return new Response(null, { status: 204, headers });
    }

    if (
      origin &&
      allowedOrigins.length &&
      !allowedOrigins.includes("*") &&
      !allowedOrigins.includes(origin)
    ) {
      return Response.json({ error: "Origin not allowed." }, { status: 403, headers });
    }

    if (!env.GOOGLE_TRANSLATE_API_KEY) {
      return Response.json(
        { error: "Google Cloud Translation is not configured." },
        { status: 503, headers },
      );
    }

    if (request.method === "GET" && url.pathname.endsWith("/languages")) {
      try {
        const googleUrl = new URL(
          "https://translation.googleapis.com/language/translate/v2/languages",
        );
        googleUrl.searchParams.set("key", env.GOOGLE_TRANSLATE_API_KEY);
        googleUrl.searchParams.set("target", url.searchParams.get("target") || "en");

        const googleResponse = await fetch(googleUrl);
        const result = (await googleResponse.json()) as GoogleTranslationResponse;
        if (!googleResponse.ok) {
          return Response.json(
            { error: result.error?.message || "Could not load Google Translate languages." },
            { status: googleResponse.status, headers },
          );
        }

        const languages = (result.data?.languages ?? [])
          .filter((item) => item.language && item.name)
          .map((item) => ({ code: item.language, name: item.name }));

        return Response.json({ languages }, { headers });
      } catch {
        return Response.json(
          { error: "Could not load Google Translate languages." },
          { status: 502, headers },
        );
      }
    }

    if (request.method !== "POST") {
      return Response.json(
        { error: "Use GET /languages or POST / for translation." },
        { status: 405, headers },
      );
    }

    try {
      const body = (await request.json()) as {
        q?: unknown;
        target?: unknown;
        source?: unknown;
        format?: unknown;
      };
      const texts = Array.isArray(body.q) ? body.q : [body.q];
      const target = typeof body.target === "string" ? body.target : "";
      const source = typeof body.source === "string" ? body.source : undefined;

      if (
        !texts.length ||
        texts.length > 40 ||
        texts.some((item) => typeof item !== "string" || item.length > 5000)
      ) {
        return Response.json(
          { error: "Send between 1 and 40 text strings, each no longer than 5,000 characters." },
          { status: 400, headers },
        );
      }

      if (
        !/^[a-zA-Z-]{2,12}$/.test(target) ||
        (source && !/^[a-zA-Z-]{2,12}$/.test(source))
      ) {
        return Response.json(
          { error: "A valid target language is required." },
          { status: 400, headers },
        );
      }

      const googleResponse = await fetch(
        "https://translation.googleapis.com/language/translate/v2?key=" +
          encodeURIComponent(env.GOOGLE_TRANSLATE_API_KEY),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: texts,
            target,
            ...(source ? { source } : {}),
            format: body.format === "html" ? "html" : "text",
          }),
        },
      );

      const result = (await googleResponse.json()) as GoogleTranslationResponse;
      if (!googleResponse.ok) {
        return Response.json(
          { error: result.error?.message || "Google Translation request failed." },
          { status: googleResponse.status, headers },
        );
      }

      return Response.json(
        { translations: result.data?.translations ?? [] },
        { headers },
      );
    } catch {
      return Response.json({ error: "Invalid translation request." }, { status: 400, headers });
    }
  },
};
