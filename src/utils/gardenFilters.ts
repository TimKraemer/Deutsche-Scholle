/**
 * Utility-Funktionen für Garten-Filterung
 * Wird sowohl auf der Startseite als auch auf der Detailseite verwendet
 */
import type { Garden } from "../types/garden";
import { gardenValueToNumber } from "./formatting";

export interface FilterRanges {
  minPrice: number;
  maxPrice: number;
  minSize: number;
  maxSize: number;
}

const RANGE_KEYS = ["minPrice", "maxPrice", "minSize", "maxSize"] as const;

export interface FilterValues {
  minPrice: number;
  maxPrice: number;
  minSize: number;
  maxSize: number;
  onlyAvailableNow: boolean;
}

/**
 * Wendet Filter auf Gärten an
 * Diese Funktion wird sowohl auf der Startseite als auch auf der Detailseite verwendet,
 * um konsistente Filterung zu gewährleisten
 */
export function applyGardenFilters(gardens: Garden[], filters: FilterValues): Garden[] {
  return gardens.filter((garden) => {
    // Preis-Filter ("n.V." wird als 0 behandelt)
    const price = gardenValueToNumber(garden.valuation);
    if (price < filters.minPrice || price > filters.maxPrice) {
      return false;
    }

    // Größen-Filter
    if (garden.size < filters.minSize || garden.size > filters.maxSize) {
      return false;
    }

    // "Nur frei ab sofort" Filter
    if (filters.onlyAvailableNow) {
      const lowerCaseDate = garden.availableFrom.toLowerCase();
      if (lowerCaseDate !== "sofort" && lowerCaseDate !== "ab sofort") {
        return false;
      }
    }

    return true;
  });
}

/**
 * Lädt Filter-Werte aus localStorage
 * Gibt Standard-Werte zurück wenn keine gespeichert sind. Eine als null gespeicherte Grenze
 * hat der Nutzer nicht verändert, sie folgt der aktuellen Liste.
 */
export function loadFiltersFromStorage(defaultRanges: FilterRanges): FilterValues {
  try {
    const saved = localStorage.getItem("gardenFilters");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validiere gespeicherte Werte
      if (
        RANGE_KEYS.every((key) => parsed[key] === null || typeof parsed[key] === "number") &&
        typeof parsed.onlyAvailableNow === "boolean"
      ) {
        return {
          minPrice: parsed.minPrice ?? defaultRanges.minPrice,
          maxPrice: parsed.maxPrice ?? defaultRanges.maxPrice,
          minSize: parsed.minSize ?? defaultRanges.minSize,
          maxSize: parsed.maxSize ?? defaultRanges.maxSize,
          onlyAvailableNow: parsed.onlyAvailableNow,
        };
      }
    }
  } catch (error) {
    console.error("Error loading filters from storage:", error);
  }

  // Fallback: Standard-Werte (alle Filter deaktiviert)
  return {
    minPrice: defaultRanges.minPrice,
    maxPrice: defaultRanges.maxPrice,
    minSize: defaultRanges.minSize,
    maxSize: defaultRanges.maxSize,
    onlyAvailableNow: false,
  };
}

/**
 * Speichert Filter-Werte in localStorage
 * Grenzen auf dem Standardwert werden als null gespeichert. Sonst würde ein später
 * hinzugekommener größerer oder teurerer Garten beim nächsten Besuch ausgefiltert.
 */
export function saveFiltersToStorage(filters: FilterValues, defaultRanges: FilterRanges): void {
  const stored: Record<string, number | boolean | null> = {
    onlyAvailableNow: filters.onlyAvailableNow,
  };
  for (const key of RANGE_KEYS) {
    stored[key] = filters[key] === defaultRanges[key] ? null : filters[key];
  }
  try {
    localStorage.setItem("gardenFilters", JSON.stringify(stored));
  } catch (error) {
    console.error("Error saving filters to storage:", error);
  }
}

/**
 * Prüft ob Filter aktiv sind (d.h. von Standard-Werten abweichen)
 *
 * @param filters Aktuelle Filter-Werte
 * @param defaultRanges Gerundete Standard-Werte (für Vergleich)
 */
export function hasActiveFilters(filters: FilterValues, defaultRanges: FilterRanges): boolean {
  return (
    filters.minPrice !== defaultRanges.minPrice ||
    filters.maxPrice !== defaultRanges.maxPrice ||
    filters.minSize !== defaultRanges.minSize ||
    filters.maxSize !== defaultRanges.maxSize ||
    filters.onlyAvailableNow
  );
}
