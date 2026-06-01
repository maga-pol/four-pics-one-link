export type Level = {
  id: number;
  name: string;
  answer: string;
  acceptedAnswers: string[];
  continent: string;
  photoQuery: string;
  photoSeeds: number[];
};

// Photos pulled from loremflickr (Flickr CC photos by tag) — different `lock`
// seeds yield 4 different photos of the same landmark.
export const LEVELS: Level[] = [
  {
    id: 1,
    name: "Eiffel Tower, Paris",
    answer: "France",
    acceptedAnswers: ["france"],
    continent: "Europe",
    photoQuery: "eiffel,tower,paris",
    photoSeeds: [101, 102, 103, 104],
  },
  {
    id: 2,
    name: "Statue of Liberty, New York",
    answer: "USA",
    acceptedAnswers: ["usa", "united states", "us", "america", "united states of america"],
    continent: "North America",
    photoQuery: "statue,of,liberty,newyork",
    photoSeeds: [201, 202, 203, 204],
  },
  {
    id: 3,
    name: "Colosseum, Rome",
    answer: "Italy",
    acceptedAnswers: ["italy", "italia"],
    continent: "Europe",
    photoQuery: "colosseum,rome,italy",
    photoSeeds: [301, 302, 303, 304],
  },
  {
    id: 4,
    name: "Burj Khalifa, Dubai",
    answer: "UAE",
    acceptedAnswers: ["uae", "united arab emirates", "emirates"],
    continent: "Asia",
    photoQuery: "burj,khalifa,dubai",
    photoSeeds: [401, 402, 403, 404],
  },
  {
    id: 5,
    name: "Shibuya Crossing, Tokyo",
    answer: "Japan",
    acceptedAnswers: ["japan", "nippon"],
    continent: "Asia",
    photoQuery: "shibuya,crossing,tokyo",
    photoSeeds: [501, 502, 503, 504],
  },
  {
    id: 6,
    name: "Machu Picchu, Peru",
    answer: "Peru",
    acceptedAnswers: ["peru"],
    continent: "South America",
    photoQuery: "machu,picchu,peru",
    photoSeeds: [601, 602, 603, 604],
  },
  {
    id: 7,
    name: "Great Wall of China",
    answer: "China",
    acceptedAnswers: ["china"],
    continent: "Asia",
    photoQuery: "great,wall,china",
    photoSeeds: [701, 702, 703, 704],
  },
  {
    id: 8,
    name: "Santorini, Greece",
    answer: "Greece",
    acceptedAnswers: ["greece", "hellas"],
    continent: "Europe",
    photoQuery: "santorini,greece,oia",
    photoSeeds: [801, 802, 803, 804],
  },
  {
    id: 9,
    name: "Times Square, New York",
    answer: "USA",
    acceptedAnswers: ["usa", "united states", "us", "america", "united states of america"],
    continent: "North America",
    photoQuery: "times,square,newyork",
    photoSeeds: [901, 902, 903, 904],
  },
  {
    id: 10,
    name: "Petra, Jordan",
    answer: "Jordan",
    acceptedAnswers: ["jordan"],
    continent: "Asia",
    photoQuery: "petra,jordan,treasury",
    photoSeeds: [1001, 1002, 1003, 1004],
  },
];

export function getPhotoUrl(query: string, seed: number, size = 640) {
  return `https://loremflickr.com/${size}/${size}/${query}/all?lock=${seed}`;
}

export function normalize(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
}

export function isCorrect(input: string, level: Level) {
  const n = normalize(input);
  if (!n) return false;
  return level.acceptedAnswers.some((a) => normalize(a) === n);
}