export type Track = {
  id: string;
  name: string;
  flag: string;
  description: string;
  laps: number;
};

export const TRACKS: Track[] = [
  {
    id: "circuit",
    name: "Sunny Circuit",
    flag: "🏁",
    description: "A friendly oval circuit. Drive 3 laps and earn coins!",
    laps: 3,
  },
];

export function getTrack(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}
