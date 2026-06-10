export type Level = {
  id: number;
  name: string;
  answer: string;
  acceptedAnswers: string[];
  continent: string;
  photoQuery: string;
  photoSeeds: number[];
  photoUrls?: string[];
};

export const LEVELS: Level[] = [];

export const SHUFFLE_KEY = "gtc-shuffle";

export function loadShuffledLevels(): Level[] {
  return LEVELS;
}

export function resetAndShuffleLevels(): Level[] {
  return LEVELS;
}

export function getPhotoUrl(query: string, seed: number, size = 640) {
  const tags = query
    .toLowerCase()
    .replace(/[^a-z0-9, ]/g, "")
    .split(/[,\s]+/)
    .filter(Boolean)
    .slice(0, 4)
    .map(encodeURIComponent)
    .join(",");

  return `https://source.unsplash.com/featured/${size}x${size}/?${tags}&sig=${seed}`;
}

export function normalize(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, "");
}

export function isCorrect(input: string, level: Level) {
  const n = normalize(input);
  if (!n) return false;
  return level.acceptedAnswers.some((a) => normalize(a) === n);
}
