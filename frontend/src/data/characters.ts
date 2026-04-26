import type { PaletteKey, ShapeKey } from "../components/Blob";

export interface Character {
  key: string;
  name: string;
  palette: PaletteKey;
  shape: ShapeKey;
  price: number;
  tagline: string;
}

export const CHARACTERS: Character[] = [
  {
    key: "cream_wide",
    name: "Pudge",
    palette: "cream",
    shape: "wide",
    price: 0,
    tagline: "Your loyal companion",
  },
  {
    key: "peach_classic",
    name: "Peachy",
    palette: "peach",
    shape: "classic",
    price: 100,
    tagline: "Classic and cheerful",
  },
  {
    key: "butter_eared",
    name: "Sunny",
    palette: "butter",
    shape: "eared",
    price: 200,
    tagline: "Golden and full of energy",
  },
  {
    key: "rose_baby",
    name: "Rosey",
    palette: "rose",
    shape: "baby",
    price: 250,
    tagline: "Tiny but mighty",
  },
  {
    key: "coral_spike",
    name: "Ember",
    palette: "coral",
    shape: "spike",
    price: 300,
    tagline: "Fierce and fiery",
  },
  {
    key: "honey_tall",
    name: "Honey",
    palette: "honey",
    shape: "tall",
    price: 350,
    tagline: "Sweet and statuesque",
  },
];

export function getCharacter(key: string): Character {
  return CHARACTERS.find((c) => c.key === key) ?? CHARACTERS[0];
}
