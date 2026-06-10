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

type WikimediaImagePage = {
  title?: string;
  imageinfo?: Array<{
    thumburl?: string;
    url?: string;
    mime?: string;
  }>;
};

async function fetchWikimediaPhotoUrls(query: string, seeds: number[]) {
  const search = query.replace(/,/g, " ");
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "24");
  url.searchParams.set("gsrsearch", search);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime");
  url.searchParams.set("iiurlwidth", "640");

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "WorldQuizRace/1.0 (student geography quiz)",
      },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];

    const json = await res.json();
    const pages = Object.values(json?.query?.pages ?? {}) as WikimediaImagePage[];
    const urls = pages
      .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""))
      .map((page) => page.imageinfo?.[0])
      .filter((image) => image?.mime?.startsWith("image/"))
      .map((image) => image?.thumburl ?? image?.url)
      .filter((imageUrl): imageUrl is string => Boolean(imageUrl));

    if (urls.length <= 4) return urls;

    const start = Math.abs(seeds[0] ?? 0) % urls.length;
    return Array.from({ length: 4 }, (_, i) => urls[(start + i) % urls.length]);
  } catch {
    return [];
  }
}

const PHOTO_FRIENDLY_COUNTRY_CODES = [
  "AE",
  "AR",
  "AT",
  "AU",
  "BE",
  "BR",
  "CA",
  "CH",
  "CL",
  "CN",
  "CZ",
  "DE",
  "DK",
  "EG",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HR",
  "HU",
  "ID",
  "IE",
  "IN",
  "IS",
  "IT",
  "JP",
  "KR",
  "MA",
  "MX",
  "MY",
  "NL",
  "NO",
  "NZ",
  "PE",
  "PH",
  "PL",
  "PT",
  "QA",
  "SA",
  "SE",
  "SG",
  "TH",
  "TR",
  "US",
  "VN",
  "ZA",
];

const COUNTRY_CONTINENTS: Record<string, string> = {
  AE: "Asia",
  AR: "South America",
  AT: "Europe",
  AU: "Oceania",
  BE: "Europe",
  BR: "South America",
  CA: "North America",
  CH: "Europe",
  CL: "South America",
  CN: "Asia",
  CZ: "Europe",
  DE: "Europe",
  DK: "Europe",
  EG: "Africa",
  ES: "Europe",
  FI: "Europe",
  FR: "Europe",
  GB: "Europe",
  GR: "Europe",
  HR: "Europe",
  HU: "Europe",
  ID: "Asia",
  IE: "Europe",
  IN: "Asia",
  IS: "Europe",
  IT: "Europe",
  JP: "Asia",
  KR: "Asia",
  MA: "Africa",
  MX: "North America",
  MY: "Asia",
  NL: "Europe",
  NO: "Europe",
  NZ: "Oceania",
  PE: "South America",
  PH: "Asia",
  PL: "Europe",
  PT: "Europe",
  QA: "Asia",
  SA: "Asia",
  SE: "Europe",
  SG: "Asia",
  TH: "Asia",
  TR: "Asia",
  US: "North America",
  VN: "Asia",
  ZA: "Africa",
};

const COUNTRY_ALIASES: Record<string, string[]> = {
  AE: ["uae", "united arab emirates", "emirates"],
  GB: ["uk", "united kingdom", "great britain", "britain", "england"],
  KR: ["south korea", "korea", "republic of korea"],
  US: ["usa", "us", "united states", "united states of america", "america"],
};

function getRandomTargetCountry() {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const code =
    PHOTO_FRIENDLY_COUNTRY_CODES[Math.floor(Math.random() * PHOTO_FRIENDLY_COUNTRY_CODES.length)] ??
    "JP";
  return {
    code,
    name: names.of(code) ?? code,
  };
}

async function buildFallbackLevel(questionNumber: number) {
  const country = getRandomTargetCountry();
  const photoQuery = cleanPhotoQuery(`landmark,${country.name}`);
  const photoSeeds = seedsForQuestion(questionNumber, `${country.name}:${photoQuery}`);
  const photoUrls = await fetchWikimediaPhotoUrls(photoQuery, photoSeeds);
  const acceptedAnswers = Array.from(
    new Set([
      country.name,
      country.name.toLowerCase(),
      country.code.toLowerCase(),
      ...(COUNTRY_ALIASES[country.code] ?? []),
    ]),
  );

  return {
    id: 20_000 + questionNumber,
    name: `Landmarks of ${country.name}`,
    answer: country.name,
    acceptedAnswers,
    continent: COUNTRY_CONTINENTS[country.code] ?? "World",
    photoQuery,
    photoSeeds,
    photoUrls,
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
    if (!config.geminiApiKey) {
      return {
        source: "fallback" as const,
        reason: "missing_key" as const,
        level: await buildFallbackLevel(data.questionNumber),
      };
    }
    const targetCountry = getRandomTargetCountry();

    const prompt = [
      "You generate one geography quiz question for a student arcade game.",
      "Return ONLY compact JSON. No markdown.",
      "The player sees 4 photos from an image-search source and guesses the country.",
      `Target country/region: ${targetCountry.name} (${targetCountry.code}).`,
      "Generate the quiz ONLY for this target country/region.",
      "Choose a real famous capital, landmark, monument, skyline, or recognizable tourist place from the target.",
      "Use simple, popular, photo-friendly places. Avoid obscure locations.",
      `Difficulty: ${data.difficulty}. Question number: ${data.questionNumber}.`,
      `answer must be "${targetCountry.name}" or its common country abbreviation.`,
      "acceptedAnswers must include lowercase variants, the official/common country name, and common abbreviations if they exist.",
      `photoQuery must be simple comma-separated English tags for image search. Use one of these patterns: "capital,${targetCountry.name}", "landmark,${targetCountry.name}", "city,${targetCountry.name}", or "tourism,${targetCountry.name}".`,
      "Do not use long phrases, rare proper nouns, URLs, hashtags, or camera words.",
      'Schema: {"name":"Famous Place, City","answer":"Country","acceptedAnswers":["country","common country name"],"continent":"Continent","photoQuery":"landmark,country"}',
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
              temperature: 0.65,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.error("Gemini quiz generation failed", {
          status: res.status,
          statusText: res.statusText,
          body: errorText.slice(0, 500),
        });
        return {
          source: "fallback" as const,
          reason: "gemini_error" as const,
          level: await buildFallbackLevel(data.questionNumber),
        };
      }

      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") {
        return {
          source: "fallback" as const,
          reason: "bad_response" as const,
          level: await buildFallbackLevel(data.questionNumber),
        };
      }

      const parsed = extractJson(text);
      const quiz = generatedQuizSchema.safeParse(parsed);
      if (!quiz.success) {
        return {
          source: "fallback" as const,
          reason: "bad_response" as const,
          level: await buildFallbackLevel(data.questionNumber),
        };
      }

      const photoQuery = cleanPhotoQuery(quiz.data.photoQuery);
      if (!photoQuery) {
        return {
          source: "fallback" as const,
          reason: "bad_response" as const,
          level: await buildFallbackLevel(data.questionNumber),
        };
      }

      const photoSeeds = seedsForQuestion(data.questionNumber, `${quiz.data.name}:${photoQuery}`);
      const photoUrls = await fetchWikimediaPhotoUrls(photoQuery, photoSeeds);

      return {
        source: "gemini" as const,
        reason: null,
        level: {
          id: 10_000 + data.questionNumber,
          name: quiz.data.name,
          answer: quiz.data.answer,
          acceptedAnswers: quiz.data.acceptedAnswers,
          continent: quiz.data.continent,
          photoQuery,
          photoSeeds,
          photoUrls,
        },
      };
    } catch (error) {
      console.error("Quiz generation failed", error);
      return {
        source: "fallback" as const,
        reason: "server_error" as const,
        level: await buildFallbackLevel(data.questionNumber),
      };
    }
  });
