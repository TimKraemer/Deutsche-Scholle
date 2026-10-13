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

const TRACKED_FIELDS = ["parcel", "size", "availableFrom", "valuation", "valueReduction"] as const;

export interface GardenChange {
  date: string;
  field: (typeof TRACKED_FIELDS)[number];
  from: Garden[(typeof TRACKED_FIELDS)[number]];
  to: Garden[(typeof TRACKED_FIELDS)[number]];
}

export interface GardenHistory {
  number: string;
  parcel: string; // zuletzt bekannte Parzelle
  firstSeen: string; // erster Stand, in dem der Garten frei war
  lastSeen: string; // letzter Stand, in dem er frei war
  goneBy: string | null; // erster Stand danach ohne den Garten, null = im letzten Stand frei
  periods: number; // wie oft der Garten frei wurde
  changes: GardenChange[]; // geänderte Angaben gegenüber dem vorherigen Auftauchen
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

/** Fasst den Verlauf pro Garten zusammen. Erwartet die Stände nach Datum sortiert. */
export function summarizeHistory(snapshots: HistorySnapshot[]): GardenHistory[] {
  const byNumber = new Map<string, GardenHistory>();
  const lastKnown = new Map<string, Garden>();
  let previous = new Set<string>();

  for (const snapshot of snapshots) {
    const current = new Set(snapshot.gardens.map((g) => g.number));
    for (const garden of snapshot.gardens) {
      const entry = byNumber.get(garden.number);
      const last = lastKnown.get(garden.number);
      lastKnown.set(garden.number, garden);
      if (!entry || !last) {
        byNumber.set(garden.number, {
          number: garden.number,
          parcel: garden.parcel,
          firstSeen: snapshot.date,
          lastSeen: snapshot.date,
          goneBy: null,
          periods: 1,
          changes: [],
        });
        continue;
      }
      if (!previous.has(garden.number)) {
        entry.periods += 1;
      }
      for (const field of TRACKED_FIELDS) {
        if (garden[field] !== last[field]) {
          entry.changes.push({ date: snapshot.date, field, from: last[field], to: garden[field] });
        }
      }
      entry.parcel = garden.parcel;
      entry.lastSeen = snapshot.date;
      entry.goneBy = null;
    }
    for (const number of previous) {
      const entry = byNumber.get(number);
      if (entry && !current.has(number)) {
        entry.goneBy = snapshot.date;
      }
    }
    previous = current;
  }

  return [...byNumber.values()].sort(
    (a, b) =>
      (Number.parseInt(a.number, 10) || 0) - (Number.parseInt(b.number, 10) || 0) ||
      a.number.localeCompare(b.number)
  );
}
