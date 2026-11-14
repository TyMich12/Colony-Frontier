interface Env {
  GOOGLE_TRANSLATE_API_KEY: string;
  ALLOWED_ORIGIN?: string;
}

interface GoogleTranslationResponse {
  data?: {
    translations?: Array<{ translatedText?: string; detectedSourceLanguage?: string }>;
  };
}

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const headers = corsHeaders(allowedOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "POST") {
      return Response.json({ error: "Use POST for translation requests." }, { status: 405, headers });
    }
    if (!env.GOOGLE_TRANSLATE_API_KEY) {
      return Response.json({ error: "Google Cloud Translation is not configured." }, { status: 503, headers });
    }
    if (allowedOrigin !== "*" && origin && origin !== allowedOrigin) {
      return Response.json({ error: "Origin not allowed." }, { status: 403, headers });
    }

    try {
      const body = await request.json() as { q?: unknown; target?: unknown; source?: unknown; format?: unknown };
      const texts = Array.isArray(body.q) ? body.q : [body.q];
      const target = typeof body.target === "string" ? body.target : "";
      const source = typeof body.source === "string" ? body.source : undefined;
      if (!texts.length || texts.length > 40 || texts.some((item) => typeof item !== "string" || item.length > 5000)) {
        return Response.json({ error: "Send between 1 and 40 text strings, each no longer than 5,000 characters." }, { status: 400, headers });
      }
      if (!/^[a-zA-Z-]{2,12}$/.test(target) || (source && !/^[a-zA-Z-]{2,12}$/.test(source))) {
        return Response.json({ error: "A valid target language is required." }, { status: 400, headers });
      }

      const googleResponse = await fetch(
        "https://translation.googleapis.com/language/translate/v2?key=" + encodeURIComponent(env.GOOGLE_TRANSLATE_API_KEY),
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
      const result = await googleResponse.json() as GoogleTranslationResponse & { error?: { message?: string } };
      if (!googleResponse.ok) {
        return Response.json({ error: result.error?.message || "Google Translation request failed." }, { status: googleResponse.status, headers });
      }
      return Response.json({ translations: result.data?.translations ?? [] }, { headers });
    } catch {
      return Response.json({ error: "Invalid translation request." }, { status: 400, headers });
    }
  },
};
