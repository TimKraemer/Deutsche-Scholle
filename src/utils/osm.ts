import type { Garden } from '../types/garden';
import { getFromCache, setCache, CacheKeys, clearCache as clearOSMCache } from './cache';

/**
 * Leert den gesamten OSM-Cache
 * Nützlich wenn neue Daten in OSM hinzugefügt wurden und sofort sichtbar sein sollen
 */
export function clearCache(): void {
  clearOSMCache();
}

/**
 * Leert den Cache für einen spezifischen Garten
 * @param gardenNumber Die Gartennummer
 */
export function clearGardenCache(gardenNumber: string): void {
  const cacheKey = CacheKeys.GARDEN(gardenNumber);
  try {
    localStorage.removeItem(`osm_cache_${cacheKey}`);
  } catch (error) {
    console.error('Error clearing garden cache:', error);
  }
}

// Liste von Overpass API Servern als Fallback
const OVERPASS_API_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://overpass-api.openstreetmap.fr/api/interpreter',
];


export interface OSMWay {
  type: 'way';
  id: number;
  nodes: number[];
  geometry?: Array<{ lat: number; lon: number }>;
  tags: {
    [key: string]: string;
  };
}

export interface OSMResponse {
  elements: OSMWay[];
}

/**
 * Führt einen Overpass API Request mit Retry-Logik und Fallback-Servern aus
 * @param query Die Overpass Query
 * @param maxRetries Maximale Anzahl von Retries pro Server
 * @param retryDelay Initiale Verzögerung zwischen Retries in ms
 */
async function fetchOverpassAPI(
  query: string,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  // Versuche jeden Server
  for (const serverUrl of OVERPASS_API_SERVERS) {
    // Retry-Logik für jeden Server
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        // Längere Timeouts für komplexere Queries
        const timeout = attempt === 0 ? 30000 : 45000; // 30s bzw. 45s
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // Wenn erfolgreich, gib Response zurück
        if (response.ok) {
          return response;
        }
        
        // Bei 504 Gateway Timeout, versuche Retry
        if (response.status === 504 || response.status === 503) {
          // Warte mit Exponential Backoff bevor Retry
          if (attempt < maxRetries - 1) {
            const delay = retryDelay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // Bei anderen Fehlern, versuche nächsten Server
        if (response.status !== 504 && response.status !== 503) {
          lastError = new Error(`Overpass API error: ${response.status} ${response.statusText}`);
          break; // Versuche nächsten Server
        }
        
        lastError = new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      } catch (error: any) {
        // Bei AbortError (Timeout), versuche Retry
        if (error.name === 'AbortError' && attempt < maxRetries - 1) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        lastError = error;
        // Bei anderen Fehlern, versuche nächsten Server
        if (error.name !== 'AbortError') {
          break;
        }
      }
    }
  }
  
  // Alle Server und Retries fehlgeschlagen
  throw lastError || new Error('Overpass API: All servers failed');
}

/**
 * Lädt einen Garten direkt über die OSM Way ID
 */
export async function loadGardenByWayId(wayId: number, forceRefresh: boolean = false): Promise<OSMWay | null> {
  const cacheKey = `garden_way_${wayId}`;
  if (!forceRefresh) {
    const cached = getFromCache<OSMWay>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const query = `
    [out:json][timeout:25];
    (
      way(${wayId});
    );
    out geom;
  `;

  try {
    const response = await fetchOverpassAPI(query);

    const data: OSMResponse = await response.json();
    
    if (data.elements && data.elements.length > 0) {
      const result = data.elements[0];
      // 2 Stunden TTL für Way-ID Lookups
      setCache(cacheKey, result, 2 * 60 * 60 * 1000);
      return result;
    }

    return null;
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error('Error loading garden by way ID:', error);
    }
    const staleCache = getFromCache<OSMWay>(cacheKey);
    if (staleCache) {
      return staleCache;
    }
    return null;
  }
}

/**
 * Hybrid-Ansatz: Gibt sofort gecachte Daten zurück und aktualisiert im Hintergrund
 * @param wayId Die OSM Way ID
 * @param onUpdate Callback der aufgerufen wird, wenn neue Daten verfügbar sind
 * @returns Gecachte Daten (falls vorhanden) oder null
 */
export function loadGardenByWayIdWithUpdate(
  wayId: number,
  onUpdate?: (garden: OSMWay | null) => void
): OSMWay | null {
  const cacheKey = `garden_way_${wayId}`;
  
  // Gib sofort gecachte Daten zurück
  const cached = getFromCache<OSMWay>(cacheKey);
  
  // Starte Background-Update (nicht await, läuft parallel)
  loadGardenByWayId(wayId, false)
    .then((updatedGarden) => {
      // Nur Callback aufrufen wenn sich Daten geändert haben
      if (updatedGarden && (!cached || cached.id !== updatedGarden.id || JSON.stringify(cached.geometry) !== JSON.stringify(updatedGarden.geometry))) {
        onUpdate?.(updatedGarden);
      } else if (!updatedGarden && cached) {
        // Cache wurde gelöscht oder nicht gefunden
        onUpdate?.(null);
      }
    })
    .catch((error) => {
      // Bei Fehler einfach ignorieren, Cache bleibt bestehen
      console.error('Background update failed:', error);
    });
  
  return cached;
}

/**
 * Findet die umschließende Parzelle für einen Garten
 * Sucht nach übergeordneten Ways oder Relations mit allotments=allotments oder allotments=site
 */
export async function findEnclosingParcel(gardenWay: OSMWay): Promise<string | null> {
  if (!gardenWay.geometry || gardenWay.geometry.length === 0) {
    return null;
  }

  // Berechne Bounds des Gartens
  const lats = gardenWay.geometry.map(p => p.lat);
  const lons = gardenWay.geometry.map(p => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Erweitere Bounds leicht für die Suche
  const searchMargin = 0.001; // ~100m
  const searchMinLat = minLat - searchMargin;
  const searchMaxLat = maxLat + searchMargin;
  const searchMinLon = minLon - searchMargin;
  const searchMaxLon = maxLon + searchMargin;

  // Suche nach übergeordneten Parzellen
  // 1. Suche nach allotments=allotments oder allotments=site (übergeordnete Parzellen)
  // 2. Suche auch nach allotments=plot mit Namen (könnten größere Parzellen sein wie "Klostergärten 1")
  // 3. Suche nach Relations die Parzellen beschreiben
  const query = `
    [out:json][timeout:15];
    (
      way["allotments"~"^(allotments|site)$"]["name"](${searchMinLat},${searchMinLon},${searchMaxLat},${searchMaxLon});
      way["allotments"="plot"]["name"](${searchMinLat},${searchMinLon},${searchMaxLat},${searchMaxLon});
      relation["allotments"~"^(allotments|site)$"]["name"](${searchMinLat},${searchMinLon},${searchMaxLat},${searchMaxLon});
      relation["allotments"="plot"]["name"](${searchMinLat},${searchMinLon},${searchMaxLat},${searchMaxLon});
    );
    out geom;
  `;

  try {
    const response = await fetchOverpassAPI(query, 2, 1500); // Weniger Retries für Parzellensuche
    
    if (!response.ok) {
      return null;
    }

    const data: OSMResponse = await response.json();
    
    if (data.elements && data.elements.length > 0) {
      // Berechne Mittelpunkt des Gartens
      const gardenCenter = {
        lat: (minLat + maxLat) / 2,
        lon: (minLon + maxLon) / 2,
      };

      // Filtere zuerst: Ausschluss des Gartens selbst
      const gardenWayId = gardenWay.id;
      const gardenArea = (maxLat - minLat) * (maxLon - minLon); // Ungefähre Fläche des Gartens
      
      // Berechne Fläche für jedes Element
      const elementsWithArea = data.elements.map(element => {
        if (!element.geometry || element.geometry.length === 0) {
          return { element, area: 0 };
        }
        const elLats = element.geometry.map((p: { lat: number; lon: number }) => p.lat);
        const elLons = element.geometry.map((p: { lat: number; lon: number }) => p.lon);
        const area = (Math.max(...elLats) - Math.min(...elLats)) * (Math.max(...elLons) - Math.min(...elLons));
        return { element, area };
      });
      
      // Filtere: Ausschluss des Gartens selbst
      // Behalte:
      // - Elemente mit allotments=allotments oder allotments=site (übergeordnete Parzellen)
      // - Elemente mit allotments=plot die deutlich größer sind als der Garten (mindestens 2x)
      // - Elemente ohne allotments Tag die deutlich größer sind (könnten Parzellen sein)
      const filteredElements = elementsWithArea
        .filter(({ element, area }) => {
          // Ausschluss des Gartens selbst
          if (element.id === gardenWayId) {
            return false;
          }
          
          const allotmentsTag = element.tags?.allotments;
          
          // Behalte übergeordnete Parzellen-Tags
          if (allotmentsTag === 'allotments' || allotmentsTag === 'site') {
            return true;
          }
          
          // Für allotments=plot: Nur behalten wenn deutlich größer (mindestens 2x)
          if (allotmentsTag === 'plot') {
            return area > gardenArea * 2;
          }
          
          // Für Elemente ohne allotments Tag: Nur behalten wenn deutlich größer (könnten Parzellen sein)
          // Aber ausschließen wenn es Straßen sind (haben highway Tag)
          if (element.tags?.highway) {
            return false;
          }
          
          // Andere Elemente ohne allotments: Nur wenn deutlich größer
          return area > gardenArea * 3; // Höhere Schwelle für unbekannte Tags
        })
        .map(({ element, area }) => ({ element, area }));

      // Sortiere nach Fläche (größte zuerst) - größere Parzellen haben Vorrang
      filteredElements.sort((a, b) => b.area - a.area);

      // Finde die Parzelle, die den Garten umschließt
      // Prüfe ob der Garten innerhalb der Parzelle liegt
      for (const { element } of filteredElements) {
        if (element.geometry && element.geometry.length > 0) {
          const isInside = isPointInPolygon(gardenCenter, element.geometry);
          
          if (isInside) {
            return element.tags.name || null;
          }
        }
      }
      
      // Fallback: Wenn keine gefilterte Parzelle gefunden wurde, suche nach größtem Polygon
      // das den Garten umschließt (auch wenn es allotments=plot hat, aber größer ist)
      let largestEnclosing: { element: any; area: number } | null = null;
      
      for (const element of data.elements) {
        if (element.id === gardenWayId) continue; // Überspringe Garten selbst
        
        if (element.geometry && element.geometry.length > 0) {
          const isInside = isPointInPolygon(gardenCenter, element.geometry);
          if (isInside) {
            // Berechne ungefähre Fläche des Polygons
            const lats = element.geometry.map((p: { lat: number; lon: number }) => p.lat);
            const lons = element.geometry.map((p: { lat: number; lon: number }) => p.lon);
            const area = (Math.max(...lats) - Math.min(...lats)) * (Math.max(...lons) - Math.min(...lons));
            
            if (!largestEnclosing || area > largestEnclosing.area) {
              largestEnclosing = { element, area };
            }
          }
        }
      }
      
      if (largestEnclosing && largestEnclosing.element.tags?.name) {
        return largestEnclosing.element.tags.name;
      }
      
      // Fallback: Nimm die erste gefundene Parzelle mit Name
      const firstParcelWithName = data.elements.find(el => el.tags?.name);
      if (firstParcelWithName) {
        return firstParcelWithName.tags.name || null;
      }
    }

    return null;
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error('Error finding enclosing parcel:', error);
    }
    return null;
  }
}

/**
 * Einfache Punkt-in-Polygon-Prüfung
 */
function isPointInPolygon(point: { lat: number; lon: number }, polygon: Array<{ lat: number; lon: number }>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon;
    const yi = polygon[i].lat;
    const xj = polygon[j].lon;
    const yj = polygon[j].lat;
    
    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lon < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Sucht einen Garten in OpenStreetMap anhand der Garten-Nummer
 * Verwendet Caching um API-Aufrufe zu reduzieren
 */
export async function searchGardenByNumber(gardenNumber: string, forceRefresh: boolean = false): Promise<OSMWay | null> {
  // Prüfe zuerst den Cache (außer bei Force Refresh)
  const cacheKey = CacheKeys.GARDEN(gardenNumber);
  if (!forceRefresh) {
    const cached = getFromCache<OSMWay>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Overpass Query: Suche nach allotments=plot mit name=gardenNumber
  // Suche im Bereich Osnabrück (Bounding Box)
  // Suche auch nach Varianten wie "Garten 1027" oder nur nach der Nummer
  const query = `
    [out:json][timeout:15];
    (
      way["allotments"="plot"]["name"="${gardenNumber}"](52.2,7.9,52.35,8.15);
      way["allotments"="plot"]["name"~"^${gardenNumber}$"](52.2,7.9,52.35,8.15);
      way["allotments"="plot"]["name"~"Garten ${gardenNumber}"](52.2,7.9,52.35,8.15);
    );
    out geom;
  `;

  try {
    const response = await fetchOverpassAPI(query);
    const data: OSMResponse = await response.json();
    
    if (data.elements && data.elements.length > 0) {
      // Finde den passendsten Eintrag (exakte Übereinstimmung zuerst)
      let result = data.elements.find(el => el.tags.name === gardenNumber);
      if (!result) {
        // Fallback: Nimm den ersten Eintrag
        result = data.elements[0];
      }
      
      // Speichere im Cache (2 Stunden TTL für einzelne Gärten - kürzer für schnellere Updates)
      setCache(cacheKey, result, 2 * 60 * 60 * 1000);
      return result;
    }

    return null;
  } catch (error: any) {
    console.error('Error searching garden in OSM:', error);
    // Bei Fehler: Versuche aus Cache zu laden (auch wenn abgelaufen)
    const staleCache = getFromCache<OSMWay>(cacheKey);
    if (staleCache) {
      return staleCache;
    }
    return null;
  }
}

/**
 * Hybrid-Ansatz: Gibt sofort gecachte Daten zurück und aktualisiert im Hintergrund
 * @param gardenNumber Die Gartennummer
 * @param onUpdate Callback der aufgerufen wird, wenn neue Daten verfügbar sind
 * @returns Gecachte Daten (falls vorhanden) oder null
 */
export function searchGardenByNumberWithUpdate(
  gardenNumber: string,
  onUpdate?: (garden: OSMWay | null) => void
): OSMWay | null {
  const cacheKey = CacheKeys.GARDEN(gardenNumber);
  
  // Gib sofort gecachte Daten zurück
  const cached = getFromCache<OSMWay>(cacheKey);
  
  // Starte Background-Update (nicht await, läuft parallel)
  searchGardenByNumber(gardenNumber, false)
    .then((updatedGarden) => {
      // Nur Callback aufrufen wenn sich Daten geändert haben
      if (updatedGarden && (!cached || cached.id !== updatedGarden.id || JSON.stringify(cached.geometry) !== JSON.stringify(updatedGarden.geometry))) {
        onUpdate?.(updatedGarden);
      } else if (!updatedGarden && cached) {
        // Cache wurde gelöscht oder nicht gefunden
        onUpdate?.(null);
      }
    })
    .catch((error) => {
      // Bei Fehler einfach ignorieren, Cache bleibt bestehen
      console.error('Background update failed:', error);
    });
  
  return cached;
}

/**
 * Lädt alle Gärten im Bereich Deutsche Scholle Osnabrück
 * Verwendet Caching um API-Aufrufe zu reduzieren
 */
export async function loadAllGardens(forceRefresh: boolean = false): Promise<OSMWay[]> {
  // Prüfe zuerst den Cache (außer bei Force Refresh)
  if (!forceRefresh) {
    const cached = getFromCache<OSMWay[]>(CacheKeys.ALL_GARDENS);
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  // Overpass Query: Lade alle allotments=plot im Bereich
  const query = `
    [out:json][timeout:15];
    (
      way["allotments"="plot"](52.2,7.9,52.35,8.15);
    );
    out geom;
  `;

  try {
    const response = await fetchOverpassAPI(query);
    const data: OSMResponse = await response.json();
    const gardens = data.elements || [];
    
    // Speichere im Cache (1 Stunde TTL für alle Gärten - kürzer für schnellere Updates)
    if (gardens.length > 0) {
      setCache(CacheKeys.ALL_GARDENS, gardens, 60 * 60 * 1000);
    }
    
    return gardens;
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error('Error loading all gardens from OSM:', error);
    }
    // Bei Fehler: Versuche aus Cache zu laden (auch wenn abgelaufen)
    const staleCache = getFromCache<OSMWay[]>(CacheKeys.ALL_GARDENS);
    if (staleCache && staleCache.length > 0) {
      return staleCache;
    }
    return [];
  }
}

/**
 * Hybrid-Ansatz: Gibt sofort gecachte Daten zurück und aktualisiert im Hintergrund
 * @param onUpdate Callback der aufgerufen wird, wenn neue Daten verfügbar sind
 * @returns Gecachte Daten (falls vorhanden) oder leeres Array
 */
export function loadAllGardensWithUpdate(
  onUpdate?: (gardens: OSMWay[]) => void
): OSMWay[] {
  // Gib sofort gecachte Daten zurück
  const cached = getFromCache<OSMWay[]>(CacheKeys.ALL_GARDENS) || [];
  
  // Starte Background-Update (nicht await, läuft parallel)
  loadAllGardens(false)
    .then((updatedGardens) => {
      // Nur Callback aufrufen wenn sich Daten geändert haben
      if (updatedGardens.length !== cached.length || 
          updatedGardens.some((g, i) => !cached[i] || cached[i].id !== g.id)) {
        onUpdate?.(updatedGardens);
      }
    })
    .catch((error) => {
      // Bei Fehler einfach ignorieren, Cache bleibt bestehen
      console.error('Background update failed:', error);
    });
  
  return cached;
}

/**
 * Berechnet die Fläche eines Polygons in m² (sphärische Fläche nach Gauss)
 * Verwendet die Formel für die Fläche eines Polygons auf einer Kugeloberfläche
 */
function calculatePolygonArea(geometry: Array<{ lat: number; lon: number }>): number {
  if (geometry.length < 3) {
    return 0;
  }

  const R = 6371000; // Erdradius in Metern
  let area = 0;

  // Stelle sicher, dass das Polygon geschlossen ist
  const coords = [...geometry];
  if (coords[0].lat !== coords[coords.length - 1].lat || 
      coords[0].lon !== coords[coords.length - 1].lon) {
    coords.push(coords[0]);
  }

  // Berechne die Fläche mit der sphärischen Exzess-Formel
  for (let i = 0; i < coords.length - 1; i++) {
    const j = (i + 1) % (coords.length - 1);
    
    const lat1 = (coords[i].lat * Math.PI) / 180;
    const lon1 = (coords[i].lon * Math.PI) / 180;
    const lat2 = (coords[j].lat * Math.PI) / 180;
    const lon2 = (coords[j].lon * Math.PI) / 180;

    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = Math.abs(area * R * R / 2);
  
  // Wenn die Berechnung zu klein ist, versuche eine einfachere Approximation
  if (area < 1) {
    // Berechne Bounding Box und verwende als Approximation
    const lats = geometry.map(p => p.lat);
    const lons = geometry.map(p => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    
    // Näherung: Rechteckfläche in m²
    const latDiff = (maxLat - minLat) * Math.PI / 180;
    const lonDiff = (maxLon - minLon) * Math.PI / 180;
    const avgLat = ((minLat + maxLat) / 2) * Math.PI / 180;
    
    area = R * R * latDiff * lonDiff * Math.cos(avgLat);
  }
  
  return Math.round(area);
}

/**
 * Konvertiert OSM Way zu Garden-Format
 * @param osmWay Der OSM Way für den Garten
 * @param mockData Optionale Mock-Daten aus der Datenbank
 * @param enclosingParcel Die umschließende Parzelle aus OSM (optional)
 */
export function osmWayToGarden(osmWay: OSMWay, mockData?: Partial<Garden>, enclosingParcel?: string | null): Garden | null {
  if (!osmWay.geometry || osmWay.geometry.length === 0) {
    return null;
  }

  // Berechne Zentrum der Geometrie
  const centerLat = osmWay.geometry.reduce((sum, point) => sum + point.lat, 0) / osmWay.geometry.length;
  const centerLon = osmWay.geometry.reduce((sum, point) => sum + point.lon, 0) / osmWay.geometry.length;

  // Berechne Bounds
  const lats = osmWay.geometry.map(p => p.lat);
  const lons = osmWay.geometry.map(p => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Berechne Fläche aus OSM-Geometrie
  const calculatedSize = calculatePolygonArea(osmWay.geometry);

  // Verwende umschließende Parzelle aus OSM, falls vorhanden, sonst Mock-Daten
  const parcel = enclosingParcel || mockData?.parcel || '';

  return {
    id: `garden-${osmWay.id}`,
    number: osmWay.tags.name || '',
    parcel: parcel,
    size: mockData?.size || 0, // Datenbank-Größe
    osmSize: calculatedSize, // OSM-Größe (immer setzen, auch wenn 0)
    availableFrom: mockData?.availableFrom || '',
    valuation: mockData?.valuation || 0,
    valueReduction: mockData?.valueReduction || 0,
    hasElectricity: mockData?.hasElectricity, // Optional: nur wenn bekannt
    waterConnection: mockData?.waterConnection, // Optional: nur wenn bekannt
    coordinates: [centerLat, centerLon] as [number, number],
    bounds: [[minLat, minLon], [maxLat, maxLon]] as [[number, number], [number, number]],
    osmWayId: osmWay.id,
  };
}

/**
 * Konvertiert OSM Geometrie zu Leaflet Polygon-Koordinaten
 */
export function osmGeometryToLeafletCoords(geometry: Array<{ lat: number; lon: number }>): [number, number][] {
  return geometry.map(point => [point.lat, point.lon]);
}

