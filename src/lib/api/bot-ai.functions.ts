import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getServerConfig } from "../config.server";

const botPlanSchema = z.object({
  id: z.string(),
  pace: z.number().min(0.82).max(1.16),
  aggression: z.number().min(0.45).max(0.98),
  skill: z.number().min(0.65).max(0.98),
  driftBias: z.number().min(0).max(1),
});

const responseSchema = z.object({
  bots: z.array(botPlanSchema).max(8),
});

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export const getBotRacePlan = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      trackId: z.string().min(1),
      trackName: z.string().min(1),
      botIds: z.array(z.string().min(1)).min(1).max(8),
    })
  )
  .handler(async ({ data }) => {
    const config = getServerConfig();
    if (!config.geminiApiKey) return { source: "fallback" as const, bots: [] };

    const prompt = [
      "You are the race strategist AI for an arcade Formula racing game.",
      "Return ONLY compact JSON. No markdown.",
      `Track: ${data.trackName} (${data.trackId}).`,
      `Bots: ${data.botIds.join(", ")}.`,
      "For each bot, choose a distinct driving personality.",
      "Fields: id, pace 0.82-1.16, aggression 0.45-0.98, skill 0.65-0.98, driftBias 0-1.",
      "Fast bots should still be fair and drivable for a student arcade game.",
      'Schema: {"bots":[{"id":"BOT","pace":1.02,"aggression":0.76,"skill":0.88,"driftBias":0.45}]}',
    ].join("\n");

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.85,
              responseMimeType: "application/json",
            },
          }),
        }
      );
      if (!res.ok) return { source: "fallback" as const, bots: [] };

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") return { source: "fallback" as const, bots: [] };

      const parsed = extractJson(text);
      const plan = responseSchema.safeParse(parsed);
      if (!plan.success) return { source: "fallback" as const, bots: [] };

      return { source: "gemini" as const, bots: plan.data.bots };
    } catch {
      return { source: "fallback" as const, bots: [] };
    }
  });
