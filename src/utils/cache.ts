/**
 * Cache-Utility für OSM-Daten
 * Speichert Daten in localStorage mit TTL (Time To Live)
 */

const CACHE_PREFIX = 'osm_cache_';
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 Stunden in Millisekunden

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Prüft ob ein Cache-Eintrag noch gültig ist
 */
function isCacheValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  if (!entry) return false;
  const now = Date.now();
  return (now - entry.timestamp) < entry.ttl;
}

/**
 * Liest einen Wert aus dem Cache
 */
export function getFromCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    
    if (isCacheValid(entry)) {
      return entry.data;
    } else {
      // Cache abgelaufen, entfernen
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
}

/**
 * Speichert einen Wert im Cache
 */
export function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (error) {
    console.error('Error writing to cache:', error);
    // Wenn localStorage voll ist, versuche alte Einträge zu löschen
    // Warum?
    // - localStorage hat begrenzten Speicherplatz (~5-10MB)
    // - Automatische Bereinigung ermöglicht weitere Nutzung ohne Fehler
    try {
      clearExpiredCache();
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({
        data,
        timestamp: Date.now(),
        ttl,
      }));
    } catch (e) {
      console.error('Cache full, could not save:', e);
    }
  }
}

/**
 * Entfernt abgelaufene Cache-Einträge
 */
function clearExpiredCache(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_PREFIX)) {
        const cached = localStorage.getItem(key);
        if (cached) {
          try {
            const entry: CacheEntry<unknown> = JSON.parse(cached);
            if (!isCacheValid(entry)) {
              localStorage.removeItem(key);
            }
          } catch {
            // Ungültiger Eintrag, entfernen
            localStorage.removeItem(key);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error clearing expired cache:', error);
  }
}

/**
 * Entfernt alle Cache-Einträge
 */
export function clearCache(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Cache-Keys
 */
export const CacheKeys = {
  ALL_GARDENS: 'all_gardens',
  GARDEN: (number: string) => `garden_${number}`,
} as const;

