export type F1Stage = {
  name: string;
  country: string;
  flag: string;
  length: string;
  corners: number;
};

export type F1Track = {
  id: string;
  name: string;
  region: string;
  flag: string;
  description: string;
  stages: F1Stage[];
};

export const TRACKS: F1Track[] = [
  {
    id: "europe",
    name: "F1 Europe Circuit",
    region: "Europe",
    flag: "🇪🇺",
    description: "A grand tour through the legendary European Grand Prix venues.",
    stages: [
      { name: "Monaco", country: "Monte Carlo", flag: "🇲🇨", length: "3.337 km", corners: 19 },
      { name: "Silverstone", country: "United Kingdom", flag: "🇬🇧", length: "5.891 km", corners: 18 },
      { name: "Monza", country: "Italy", flag: "🇮🇹", length: "5.793 km", corners: 11 },
      { name: "Spa-Francorchamps", country: "Belgium", flag: "🇧🇪", length: "7.004 km", corners: 19 },
    ],
  },
];

export function getTrack(id: string): F1Track | undefined {
  return TRACKS.find((t) => t.id === id);
}