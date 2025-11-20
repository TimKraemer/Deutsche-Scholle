import type { Garden } from '../types/garden';
import { getFromCache, setCache, CacheKeys } from './cache';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

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
 * Lädt einen Garten direkt über die OSM Way ID
 */
export async function loadGardenByWayId(wayId: number): Promise<OSMWay | null> {
  const cacheKey = `garden_way_${wayId}`;
  const cached = getFromCache<OSMWay>(cacheKey);
  if (cached) {
    return cached;
  }

  const query = `
    [out:json][timeout:25];
    (
      way(${wayId});
    );
    out geom;
  `;

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.statusText}`);
    }

    const data: OSMResponse = await response.json();
    
    if (data.elements && data.elements.length > 0) {
      const result = data.elements[0];
      setCache(cacheKey, result, 7 * 24 * 60 * 60 * 1000);
      return result;
    }

    return null;
  } catch (error) {
    console.error('Error loading garden by way ID:', error);
    const staleCache = getFromCache<OSMWay>(cacheKey);
    if (staleCache) {
      return staleCache;
    }
    return null;
  }
}

/**
 * Sucht einen Garten in OpenStreetMap anhand der Garten-Nummer
 * Verwendet Caching um API-Aufrufe zu reduzieren
 */
export async function searchGardenByNumber(gardenNumber: string): Promise<OSMWay | null> {
  // Prüfe zuerst den Cache
  const cacheKey = CacheKeys.GARDEN(gardenNumber);
  const cached = getFromCache<OSMWay>(cacheKey);
  if (cached) {
    return cached;
  }

  // Overpass Query: Suche nach allotments=plot mit name=gardenNumber
  // Suche im Bereich Osnabrück (Bounding Box)
  const query = `
    [out:json][timeout:25];
    (
      way["allotments"="plot"]["name"="${gardenNumber}"](52.2,7.9,52.35,8.15);
    );
    out geom;
  `;

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.statusText}`);
    }

    const data: OSMResponse = await response.json();
    
    if (data.elements && data.elements.length > 0) {
      const result = data.elements[0];
      // Speichere im Cache (7 Tage TTL für einzelne Gärten)
      setCache(cacheKey, result, 7 * 24 * 60 * 60 * 1000);
      return result;
    }

    return null;
  } catch (error) {
    console.error('Error searching garden in OSM:', error);
    // Bei Fehler: Versuche aus Cache zu laden (auch wenn abgelaufen)
    const staleCache = getFromCache<OSMWay>(cacheKey);
    if (staleCache) {
      console.log('Using stale cache for garden', gardenNumber);
      return staleCache;
    }
    return null;
  }
}

/**
 * Lädt alle Gärten im Bereich Deutsche Scholle Osnabrück
 * Verwendet Caching um API-Aufrufe zu reduzieren
 */
export async function loadAllGardens(): Promise<OSMWay[]> {
  // Prüfe zuerst den Cache
  const cached = getFromCache<OSMWay[]>(CacheKeys.ALL_GARDENS);
  if (cached && cached.length > 0) {
    return cached;
  }

  // Overpass Query: Lade alle allotments=plot im Bereich
  const query = `
    [out:json][timeout:25];
    (
      way["allotments"="plot"](52.2,7.9,52.35,8.15);
    );
    out geom;
  `;

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.statusText}`);
    }

    const data: OSMResponse = await response.json();
    const gardens = data.elements || [];
    
    // Speichere im Cache (24 Stunden TTL für alle Gärten)
    if (gardens.length > 0) {
      setCache(CacheKeys.ALL_GARDENS, gardens);
    }
    
    return gardens;
  } catch (error) {
    console.error('Error loading all gardens from OSM:', error);
    // Bei Fehler: Versuche aus Cache zu laden (auch wenn abgelaufen)
    const staleCache = getFromCache<OSMWay[]>(CacheKeys.ALL_GARDENS);
    if (staleCache && staleCache.length > 0) {
      return staleCache;
    }
    return [];
  }
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
 */
export function osmWayToGarden(osmWay: OSMWay, mockData?: Partial<Garden>): Garden | null {
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

  return {
    id: `garden-${osmWay.id}`,
    number: osmWay.tags.name || '',
    parcel: mockData?.parcel || '',
    size: mockData?.size || 0, // Datenbank-Größe
    osmSize: calculatedSize, // OSM-Größe (immer setzen, auch wenn 0)
    availableFrom: mockData?.availableFrom || '',
    valuation: mockData?.valuation || 0,
    valueReduction: mockData?.valueReduction || 0,
    hasElectricity: mockData?.hasElectricity ?? false,
    waterConnection: mockData?.waterConnection || 'kein',
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

