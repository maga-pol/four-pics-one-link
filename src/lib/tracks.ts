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
  region?: string;
  stages?: TrackStage[];
};

export const TRACKS: Track[] = [
  {
    id: "circuit",
    name: "Sunny Circuit",
    flag: "🏁",
    description: "A friendly oval circuit. Drive 3 laps and earn coins!",
    laps: 3,
    region: "Starter Route",
    stages: [
      { id: "start-finish", name: "Start / Finish", active: true },
      { id: "north-bend", name: "North Bend" },
      { id: "south-bend", name: "South Bend" },
    ],
  },
];

export function getTrack(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}
