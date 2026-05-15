export const CATEGORIES = {
  cafe:       { label: "Cafes",       icon: "☕", color: "#d4a96a", bg: "rgba(212,169,106,.12)", border: "rgba(212,169,106,.28)" },
  camping:    { label: "Camping",     icon: "⛺", color: "#6abf7b", bg: "rgba(106,191,123,.12)", border: "rgba(106,191,123,.28)" },
  country:    { label: "Countries",   icon: "🌍", color: "#6a9fd4", bg: "rgba(106,159,212,.12)", border: "rgba(106,159,212,.28)" },
  restaurant: { label: "Restaurants", icon: "🍽️", color: "#d46a6a", bg: "rgba(212,106,106,.12)", border: "rgba(212,106,106,.28)" },
  hike:       { label: "Hikes",       icon: "🥾", color: "#a8c55c", bg: "rgba(168,197,92,.12)",  border: "rgba(168,197,92,.28)"  },
  city:       { label: "Cities",      icon: "🏙️", color: "#b06ad4", bg: "rgba(176,106,212,.12)", border: "rgba(176,106,212,.28)" },
  hotel:      { label: "Hotels",      icon: "🏨", color: "#d4b06a", bg: "rgba(212,176,106,.12)", border: "rgba(212,176,106,.28)" },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export function getCategory(key: string | null | undefined) {
  if (!key) return null;
  return CATEGORIES[key as CategoryKey] ?? null;
}
