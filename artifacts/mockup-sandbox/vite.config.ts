import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";


function missionAiApiPlugin() {
  const handler = async (req: any, res: any) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "POST required" }));
      return;
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "OPENAI_API_KEY is not configured on the server." }));
      return;
    }
    try {
      let raw = "";
      for await (const chunk of req) raw += chunk.toString();
      if (raw.length > 100_000) {
        res.statusCode = 413;
        res.end(JSON.stringify({ error: "Telemetry payload too large." }));
        return;
      }
      const telemetry = JSON.parse(raw || "{}");
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: [
                "You are ChatGPT Mission Control for the Colony-Frontier educational lunar/Mars outpost simulation.",
                "Review only the supplied final telemetry, player decisions, equipment condition and active faults. Do not invent events or readings.",
                "Return JSON only with keys: outcome (COMPLETE or FAILED), summary (2-4 sentences), problems (array of at most 4 concise strings), recommendations (array of at most 4 actionable strings).",
                "Decide whether the mission objective was achieved. Completion is intentionally forgiving for Mission 1: if the mission reached its scheduled end and there is no truly critical safety failure, choose COMPLETE even when some resources, equipment or optional objectives are degraded.",
                "For later missions, use stricter judgement, but do not fail solely because an optional objective or research opportunity was missed.",
                "Choose FAILED only for clear crew-safety / life-support collapse or a mission that did not survive. Do not call a mission failed just because a resource is below 55%.",
                "Be specific about the main cause, reference the player's actual decisions when useful, and give practical next steps. Be encouraging and educational, not punitive."
              ].join(" ")
            },
            { role: "user", content: JSON.stringify(telemetry) }
          ]
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "OpenAI request failed");
      const content = data?.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content || "{}");
      const outcome = parsed.outcome === "FAILED" ? "FAILED" : "COMPLETE";
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({
        outcome,
        summary: String(parsed.summary || "Mission Control reviewed the telemetry."),
        problems: Array.isArray(parsed.problems) ? parsed.problems.map(String).slice(0, 4) : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String).slice(0, 4) : []
      }));
    } catch (error) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Mission AI analysis failed." }));
    }
  };
  return {
    name: "colony-frontier-chatgpt-mission-control",
    configureServer(server: any) {
      server.middlewares.use("/api/mission-analysis", handler);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use("/api/mission-analysis", handler);
    }
  };
}

export default defineConfig({
  plugins: [
    mockupPreviewPlugin(),
    missionAiApiPlugin(),
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },

  root: path.resolve(import.meta.dirname),

  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
  },

  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
  },
});