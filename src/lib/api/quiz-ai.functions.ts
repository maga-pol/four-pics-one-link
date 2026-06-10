import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getServerConfig } from "../config.server";

const generatedQuizSchema = z.object({
  name: z.string().min(3).max(80),
  answer: z.string().min(2).max(40),
  acceptedAnswers: z.array(z.string().min(2).max(50)).min(1).max(8),
  continent: z.string().min(3).max(30),
  photoQuery: z.string().min(3).max(80),
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

function cleanPhotoQuery(query: string) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9, ]/g, "")
    .split(/[,\s]+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(",");
}

function seedsForQuestion(questionNumber: number, text: string) {
  let hash = questionNumber * 97;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 900_000;
  }
  const base = 10_000 + Math.abs(hash);
  return [base + 1, base + 2, base + 3, base + 4];
}

function getRandomTargetCountry() {
  const regionCodes =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("region").filter((code) => /^[A-Z]{2}$/.test(code))
      : [];
  const codes = regionCodes.length > 0 ? regionCodes : ["BR", "CA", "EG", "FR", "IN", "JP"];
  const code = codes[Math.floor(Math.random() * codes.length)] ?? "JP";
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return {
    code,
    name: names.of(code) ?? code,
  };
}

export const generateQuizLevel = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      questionNumber: z.number().int().min(1).max(50),
      difficulty: z.enum(["easy", "medium", "hard"]),
    }),
  )
  .handler(async ({ data }) => {
    const config = getServerConfig();
    if (!config.geminiApiKey) return { source: "fallback" as const, level: null };
    const targetCountry = getRandomTargetCountry();

    const prompt = [
      "You generate one geography quiz question for a student arcade game.",
      "Return ONLY compact JSON. No markdown.",
      "The player sees 4 photos from loremflickr and guesses the country.",
      `Target country/region: ${targetCountry.name} (${targetCountry.code}).`,
      "Generate the quiz ONLY for this target country/region.",
      "Choose a real famous landmark, city place, monument, natural wonder, stadium, skyline, or recognizable local scene from the target.",
      "Use places with visually searchable Flickr tags. Avoid obscure locations.",
      `Difficulty: ${data.difficulty}. Question number: ${data.questionNumber}.`,
      `answer must be "${targetCountry.name}" or its common country abbreviation.`,
      "acceptedAnswers must include lowercase variants, the official/common country name, and common abbreviations if they exist.",
      "photoQuery must be 3 to 5 comma-separated English tags, no URLs.",
      'Schema: {"name":"Famous Place, City","answer":"Country","acceptedAnswers":["country","common country name"],"continent":"Continent","photoQuery":"famous,place,city"}',
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
              temperature: 0.95,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      if (!res.ok) return { source: "fallback" as const, level: null };

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") return { source: "fallback" as const, level: null };

      const parsed = extractJson(text);
      const quiz = generatedQuizSchema.safeParse(parsed);
      if (!quiz.success) return { source: "fallback" as const, level: null };

      const photoQuery = cleanPhotoQuery(quiz.data.photoQuery);
      if (!photoQuery) return { source: "fallback" as const, level: null };

      return {
        source: "gemini" as const,
        level: {
          id: 10_000 + data.questionNumber,
          name: quiz.data.name,
          answer: quiz.data.answer,
          acceptedAnswers: quiz.data.acceptedAnswers,
          continent: quiz.data.continent,
          photoQuery,
          photoSeeds: seedsForQuestion(data.questionNumber, `${quiz.data.name}:${photoQuery}`),
        },
      };
    } catch {
      return { source: "fallback" as const, level: null };
    }
  });
