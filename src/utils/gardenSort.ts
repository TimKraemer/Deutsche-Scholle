import type { Garden } from "../types/garden";
import { gardenValueToNumber } from "./formatting";

export type SortOption = "number" | "availableFrom" | "size" | "valuation";
export type SortDirection = "asc" | "desc";

export interface SortConfig {
  field: SortOption;
  direction: SortDirection;
}

const SORT_OPTIONS: SortOption[] = ["number", "availableFrom", "size", "valuation"];

/** Gespeicherte Sortierung (geteilt von Startseite und Detailseite), Standard: Nummer aufsteigend */
export function loadSortConfig(): SortConfig {
  try {
    const field = localStorage.getItem("gardenSortBy") as SortOption;
    const direction = localStorage.getItem("gardenSortDirection");
    return {
      field: SORT_OPTIONS.includes(field) ? field : "number",
      direction: direction === "desc" ? "desc" : "asc",
    };
  } catch {
    return { field: "number", direction: "asc" };
  }
}

export function saveSortConfig(config: SortConfig): void {
  try {
    localStorage.setItem("gardenSortBy", config.field);
    localStorage.setItem("gardenSortDirection", config.direction);
  } catch {
    // Ohne localStorage gilt die Sortierung nur für diesen Seitenaufruf
  }
}

// Hilfsfunktion zum Parsen des "Frei ab" Datums
const parseAvailableDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const lowerCaseDate = dateString.toLowerCase();
  if (lowerCaseDate === "sofort" || lowerCaseDate === "ab sofort") {
    return null; // "Sofort" wird als frühestes Datum behandelt
  }
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
};

// Sortiere Gärten nach ausgewählter Option und Richtung
export const sortGardens = (
  gardens: Garden[],
  sortBy: SortOption,
  direction: SortDirection = "asc"
): Garden[] => {
  return [...gardens].sort((a, b) => {
    let comparison = 0;

    if (sortBy === "number") {
      const numA = parseInt(a.number, 10);
      const numB = parseInt(b.number, 10);
      comparison = numA - numB;
    } else if (sortBy === "size") {
      comparison = a.size - b.size;
    } else if (sortBy === "valuation") {
      comparison = gardenValueToNumber(a.valuation) - gardenValueToNumber(b.valuation);
    } else {
      // Sortiere nach "Frei ab" Datum
      const dateA = parseAvailableDate(a.availableFrom);
      const dateB = parseAvailableDate(b.availableFrom);

      // "Sofort" kommt zuerst (bei aufsteigender Sortierung)
      if (dateA === null && dateB === null) comparison = 0;
      else if (dateA === null) comparison = -1;
      else if (dateB === null) comparison = 1;
      else comparison = dateA.getTime() - dateB.getTime();
    }

    // Kehre Vergleich um wenn absteigend sortiert werden soll
    return direction === "desc" ? -comparison : comparison;
  });
};

// Filtere freie Gärten
export const filterAvailableGardens = (gardens: Garden[]): Garden[] => {
  return gardens.filter((garden) => garden.availableFrom && garden.availableFrom.trim() !== "");
};
