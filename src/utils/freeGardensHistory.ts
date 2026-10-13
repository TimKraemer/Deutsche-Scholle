import type { Garden } from "../types/garden";
import { parseFreeGardens } from "./freeGardens";

/**
 * Verlauf der Liste freier Gärten (/freie-gaerten-verlauf.json). Alte Stände stammen von
 * archive.org (scripts/import-free-gardens-history.py), neue hängt der Cron-Job an
 * (scripts/update-free-gardens.py).
 */
const HISTORY_URL = "/freie-gaerten-verlauf.json";

interface HistoryFile {
  snapshots: { date: string; source: string; columns: string[]; rows: string[][] }[];
}

export interface HistorySnapshot {
  date: string; // YYYY-MM-DD
  source: string; // URL der Aufnahme oder Beschreibung der Quelle
  gardens: Garden[];
}

/** Ein Garten mit den zuletzt bekannten Angaben aus der Vereinsliste */
export interface KnownGarden {
  garden: Garden;
  date: string; // Stand, aus dem die Angaben stammen
  source: string;
  isCurrent: boolean; // steht im neuesten Stand, ist also gerade frei
}

export async function loadFreeGardensHistory(): Promise<HistorySnapshot[]> {
  const response = await fetch(HISTORY_URL);
  if (!response.ok) {
    throw new Error(`Verlauf nicht geladen: HTTP ${response.status}`);
  }
  const file = (await response.json()) as HistoryFile;
  return file.snapshots.map((s) => ({
    date: s.date,
    source: s.source,
    gardens: parseFreeGardens(s),
  }));
}

/**
 * Jeder Garten, der je auf der Liste stand, mit seinen letzten Angaben. So lassen sich auch
 * Parzelle und Größe früher freier Gärten gegen OSM prüfen. Erwartet die Stände nach Datum sortiert.
 */
export function latestKnownGardens(snapshots: HistorySnapshot[]): KnownGarden[] {
  const newest = snapshots.at(-1);
  const latest = new Map<string, KnownGarden>();
  for (const snapshot of snapshots) {
    for (const garden of snapshot.gardens) {
      latest.set(garden.number, {
        garden,
        date: snapshot.date,
        source: snapshot.source,
        isCurrent: snapshot === newest,
      });
    }
  }
  return [...latest.values()].sort(
    (a, b) =>
      (Number.parseInt(a.garden.number, 10) || 0) - (Number.parseInt(b.garden.number, 10) || 0) ||
      a.garden.number.localeCompare(b.garden.number)
  );
}
