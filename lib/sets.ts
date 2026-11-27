import catalog from "./set-catalog.json";

const sets = catalog as Record<string, string[]>;

export function setsFor(game: string) {
  return sets[game] ?? [];
}
