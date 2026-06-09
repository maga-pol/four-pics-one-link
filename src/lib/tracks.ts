export type TrackStage = {
  id: string;
  name: string;
  completed?: boolean;
  active?: boolean;
};

export type Track = {
  id: string;
  name: string;
  flag: string;
  description: string;
  laps: number;
  region: string;
  stages: TrackStage[];
};

export const TRACKS: Track[] = [
  {
    id: "circuit",
    name: "Sakura Neon Circuit",
    flag: "JP",
    description: "Race through a Japanese festival route with sakura, neon, bridges, boosts, and a tight hairpin.",
    laps: 3,
    region: "Japan Showcase",
    stages: [
      { id: "start-finish", name: "Start / Finish", active: true },
      { id: "sakura-s", name: "Sakura S-Curves" },
      { id: "hairpin", name: "Temple Hairpin" },
      { id: "bridge", name: "Lantern Bridge" },
      { id: "neon-sector", name: "Neon Chicane" },
    ],
  },
  {
    id: "dubai-grand-circuit",
    name: "Dubai Grand Circuit",
    flag: "AE",
    description: "Race a premium Dubai night circuit with long straights, neon towers, palm-lined roads, and flowing F1-inspired corners.",
    laps: 3,
    region: "Dubai Night GP",
    stages: [
      { id: "start-finish", name: "Marina Start / Finish", active: true },
      { id: "high-speed-straight", name: "High-Speed Boulevard" },
      { id: "hotel-hairpin", name: "Luxury Hotel Hairpin" },
      { id: "technical-sector", name: "Downtown Technical Sector" },
      { id: "palm-run", name: "Palm Neon Run" },
    ],
  },
];

export function getTrack(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}
