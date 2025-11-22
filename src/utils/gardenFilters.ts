/**
 * Utility-Funktionen für Garten-Filterung
 * Wird sowohl auf der Startseite als auch auf der Detailseite verwendet
 */
import type { Garden } from '../types/garden';

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
  return gardens.filter(garden => {
    // Preis-Filter
    if (garden.valuation < filters.minPrice || garden.valuation > filters.maxPrice) {
      return false;
    }

    // Größen-Filter
    if (garden.size < filters.minSize || garden.size > filters.maxSize) {
      return false;
    }

    // "Nur frei ab sofort" Filter
    if (filters.onlyAvailableNow) {
      const lowerCaseDate = garden.availableFrom.toLowerCase();
      if (lowerCaseDate !== 'sofort' && lowerCaseDate !== 'ab sofort') {
        return false;
      }
    }

    return true;
  });
}

/**
 * Lädt Filter-Werte aus localStorage
 * Gibt Standard-Werte zurück wenn keine gespeichert sind
 */
export function loadFiltersFromStorage(defaultRanges: {
  minPrice: number;
  maxPrice: number;
  minSize: number;
  maxSize: number;
}): FilterValues {
  try {
    const saved = localStorage.getItem('gardenFilters');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validiere gespeicherte Werte
      if (
        typeof parsed.minPrice === 'number' &&
        typeof parsed.maxPrice === 'number' &&
        typeof parsed.minSize === 'number' &&
        typeof parsed.maxSize === 'number' &&
        typeof parsed.onlyAvailableNow === 'boolean'
      ) {
        return {
          minPrice: parsed.minPrice,
          maxPrice: parsed.maxPrice,
          minSize: parsed.minSize,
          maxSize: parsed.maxSize,
          onlyAvailableNow: parsed.onlyAvailableNow,
        };
      }
    }
  } catch (error) {
    console.error('Error loading filters from storage:', error);
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
 */
export function saveFiltersToStorage(filters: FilterValues): void {
  try {
    localStorage.setItem('gardenFilters', JSON.stringify(filters));
  } catch (error) {
    console.error('Error saving filters to storage:', error);
  }
}

/**
 * Prüft ob Filter aktiv sind (d.h. von Standard-Werten abweichen)
 * 
 * @param filters Aktuelle Filter-Werte
 * @param defaultRanges Gerundete Standard-Werte (für Vergleich)
 */
export function hasActiveFilters(
  filters: FilterValues,
  defaultRanges: {
    minPrice: number;
    maxPrice: number;
    minSize: number;
    maxSize: number;
  }
): boolean {
  return (
    filters.minPrice !== defaultRanges.minPrice ||
    filters.maxPrice !== defaultRanges.maxPrice ||
    filters.minSize !== defaultRanges.minSize ||
    filters.maxSize !== defaultRanges.maxSize ||
    filters.onlyAvailableNow
  );
}

