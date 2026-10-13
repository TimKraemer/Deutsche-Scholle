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

// Grenzen, wenn keine Gärten geladen sind
const FALLBACK_RANGES: FilterRanges = { minPrice: 0, maxPrice: 1200, minSize: 350, maxSize: 450 };

/**
 * Slider-Grenzen aus den Gärten, nach außen gerundet auf die Schrittweite der Slider
 * (50 € / 10 m²). So sind die Grenzwerte mit dem Slider erreichbar und kein Garten fällt heraus.
 */
export function calculateRanges(gardens: Garden[]): FilterRanges {
  const prices = gardens.map((g) => gardenValueToNumber(g.valuation));
  const sizes = gardens.map((g) => g.size).filter((s) => s > 0);
  if (gardens.length === 0) {
    return FALLBACK_RANGES;
  }
  return {
    minPrice: 0,
    maxPrice: Math.ceil(Math.max(...prices, 0) / 50) * 50,
    minSize: sizes.length ? Math.floor(Math.min(...sizes) / 10) * 10 : FALLBACK_RANGES.minSize,
    maxSize: sizes.length ? Math.ceil(Math.max(...sizes) / 10) * 10 : FALLBACK_RANGES.maxSize,
  };
}

/** Heutiges Datum als YYYY-MM-DD in Ortszeit, vergleichbar mit availableFrom */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "sofort" oder ein Datum, das heute oder früher ist */
export function isAvailableNow(availableFrom: string, today: string = todayIso()): boolean {
  const value = availableFrom.toLowerCase();
  if (value === "sofort" || value === "ab sofort") {
    return true;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today;
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

    // Größe 0 heißt: in der Vereinsliste nicht lesbar. Solche Gärten nicht verstecken.
    if (garden.size > 0 && (garden.size < filters.minSize || garden.size > filters.maxSize)) {
      return false;
    }

    if (filters.onlyAvailableNow && !isAvailableNow(garden.availableFrom)) {
      return false;
    }

    return true;
  });
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Lädt Filter-Werte aus localStorage, begrenzt auf die aktuellen Grenzen.
 * Gibt die Grenzen zurück wenn nichts gespeichert ist. Eine als null gespeicherte Grenze
 * hat der Nutzer nicht verändert, sie folgt der aktuellen Liste.
 */
export function loadFiltersFromStorage(ranges: FilterRanges): FilterValues {
  let parsed: Record<string, unknown> = {};
  try {
    const saved = localStorage.getItem("gardenFilters");
    const candidate = saved ? JSON.parse(saved) : {};
    // Validiere gespeicherte Werte
    if (
      RANGE_KEYS.every((key) => candidate[key] === null || typeof candidate[key] === "number") &&
      typeof candidate.onlyAvailableNow === "boolean"
    ) {
      parsed = candidate;
    }
  } catch (error) {
    console.error("Error loading filters from storage:", error);
  }

  const value = (key: (typeof RANGE_KEYS)[number], min: number, max: number) =>
    clamp((parsed[key] as number | null | undefined) ?? ranges[key], min, max);
  return {
    minPrice: value("minPrice", ranges.minPrice, ranges.maxPrice),
    maxPrice: value("maxPrice", ranges.minPrice, ranges.maxPrice),
    minSize: value("minSize", ranges.minSize, ranges.maxSize),
    maxSize: value("maxSize", ranges.minSize, ranges.maxSize),
    onlyAvailableNow: parsed.onlyAvailableNow === true,
  };
}

/**
 * Speichert Filter-Werte in localStorage
 * Grenzen auf dem Standardwert werden als null gespeichert. Sonst würde ein später
 * hinzugekommener größerer oder teurerer Garten beim nächsten Besuch ausgefiltert.
 */
export function saveFiltersToStorage(filters: FilterValues, ranges: FilterRanges): void {
  const stored: Record<string, number | boolean | null> = {
    onlyAvailableNow: filters.onlyAvailableNow,
  };
  for (const key of RANGE_KEYS) {
    stored[key] = filters[key] === ranges[key] ? null : filters[key];
  }
  try {
    localStorage.setItem("gardenFilters", JSON.stringify(stored));
  } catch (error) {
    console.error("Error saving filters to storage:", error);
  }
}

/**
 * Prüft ob Filter aktiv sind (d.h. von den Slider-Grenzen abweichen)
 */
export function hasActiveFilters(filters: FilterValues, ranges: FilterRanges): boolean {
  return (
    filters.minPrice !== ranges.minPrice ||
    filters.maxPrice !== ranges.maxPrice ||
    filters.minSize !== ranges.minSize ||
    filters.maxSize !== ranges.maxSize ||
    filters.onlyAvailableNow
  );
}
