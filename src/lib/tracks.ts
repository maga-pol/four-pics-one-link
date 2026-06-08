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
];

export function getTrack(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}
