import { type Garden, type GardenValue, ON_REQUEST } from "../types/garden";

/**
 * Liste der freien Gärten von https://www.deutsche-scholle-os.de/freie-gaerten/index.php.
 * scripts/update-free-gardens.py legt sie als /freie-gaerten.json ab (beim Build und per Cron
 * auf dem Server). Die Datei enthält die Tabelle als Text, umgewandelt wird hier.
 */
const FREE_GARDENS_URL = "/freie-gaerten.json";

interface FreeGardensFile {
  fetchedAt: string;
  changedAt: string; // YYYY-MM-DD, letzte Änderung der Liste
  columns: string[];
  rows: string[][];
}

export interface FreeGardenList {
  gardens: Garden[];
  changedAt: string;
}

/** "1.200,00 €" -> 1200. Leere Felder sind noch nicht ermittelt und gelten als "n.V." */
function parseMoney(text: string): GardenValue {
  const value = Number.parseFloat(text.replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isNaN(value) ? ON_REQUEST : value;
}

/** "01.01.2027" -> "2027-01-01", "sofort" bleibt */
function parseAvailableFrom(text: string): string {
  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text.toLowerCase();
}

export function parseFreeGardens(file: FreeGardensFile): Garden[] {
  const col = (name: string) => file.columns.indexOf(name);
  const idx = {
    number: col("Nr."),
    parcel: col("Parzelle"),
    size: col("Größe"),
    availableFrom: col("frei ab"),
    valuation: col("Wertermittlung"),
    valueReduction: col("Wertminderung"),
  };

  return file.rows.map((row) => {
    // Die Vereinsliste markiert manche Nummern mit "*" (z. B. "279*"), für URL und OSM-ref zählt nur die Nummer
    const number = row[idx.number].replace(/\*+$/, "").trim();
    return {
      id: `garden-${number}`,
      number,
      parcel: row[idx.parcel],
      size: Number.parseInt(row[idx.size], 10) || 0,
      availableFrom: parseAvailableFrom(row[idx.availableFrom]),
      valuation: parseMoney(row[idx.valuation]),
      valueReduction: parseMoney(row[idx.valueReduction]),
    };
  });
}

let listPromise: Promise<FreeGardenList> | null = null;

async function loadFreeGardens(): Promise<FreeGardenList> {
  const response = await fetch(FREE_GARDENS_URL);
  if (!response.ok) {
    throw new Error(`Freie Gärten nicht geladen: HTTP ${response.status}`);
  }
  const file = (await response.json()) as FreeGardensFile;
  return { gardens: parseFreeGardens(file), changedAt: file.changedAt };
}

/** Lädt die Liste einmal pro Seitenaufruf, alle Komponenten teilen sich das Ergebnis */
export function getFreeGardens(): Promise<FreeGardenList> {
  if (!listPromise) {
    const promise = loadFreeGardens();
    listPromise = promise;
    promise.catch(() => {
      // Beim nächsten Aufruf erneut versuchen
      if (listPromise === promise) {
        listPromise = null;
      }
    });
  }
  return listPromise;
}

export function findGardenByNumber(gardens: Garden[], number: string): Garden | undefined {
  return gardens.find((garden) => garden.number === number);
}
