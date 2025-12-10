/**
 * Map helper utilities for calculating bounds, zoom levels, etc.
 */

import { OSNABRUECK_BOUNDS } from "./constants";
import type { OSMWay } from "./osm";

/**
 * Berechnet optimalen Zoom-Level basierend auf Bounds und Karten-Größe
 *
 * Warum eigene Berechnung statt Leaflet's fitBounds?
 * - Ermöglicht präzise Kontrolle über Zoom-Level
 * - Berücksichtigt Breitengrad-Kompression (cos(lat)) für korrekte Berechnung
 * - Verwendet Leaflet's fitBounds-Logik als Basis
 */
export function calculateOptimalZoom(
  bounds: [[number, number], [number, number]],
  mapWidth: number,
  mapHeight: number,
  padding: number = 50
): number {
  const [[minLat, minLon], [maxLat, maxLon]] = bounds;

  // Verfügbarer Platz für die Karte (mit Padding)
  const availableWidth = mapWidth - padding * 2;
  const availableHeight = mapHeight - padding * 2;

  // Berechne benötigte Breite und Höhe in Grad
  const latDiff = maxLat - minLat;
  const lonDiff = maxLon - minLon;
  const centerLat = (minLat + maxLat) / 2;

  // Berechne Zoom-Level basierend auf Breite und Höhe
  // Formel: zoom = log2(worldSize / tileSize / scale)
  const worldSize = 256; // Standard Tile-Größe

  // Berechne für Breite und Höhe separat
  const latZoom = Math.log2((availableHeight * 360) / (latDiff * worldSize));
  // Breitengrad-Kompensation: Längengrade werden zu den Polen hin schmaler
  const lonZoom = Math.log2(
    (availableWidth * 360) / (lonDiff * worldSize * Math.cos((centerLat * Math.PI) / 180))
  );

  // Nimm den kleineren Zoom-Level (damit alles sichtbar ist)
  let optimalZoom = Math.floor(Math.min(latZoom, lonZoom));

  // Begrenze auf gültigen Bereich (Leaflet unterstützt Zoom 0-22)
  optimalZoom = Math.max(10, Math.min(22, optimalZoom));

  return optimalZoom;
}

/**
 * Calculates bounds for all gardens
 */
export function calculateGardensBounds(allGardens: OSMWay[]): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  hasValidBounds: boolean;
} {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let hasValidBounds = false;

  for (const garden of allGardens) {
    if (garden.geometry && garden.geometry.length > 0) {
      for (const point of garden.geometry) {
        if (
          typeof point.lat === "number" &&
          typeof point.lon === "number" &&
          !Number.isNaN(point.lat) &&
          !Number.isNaN(point.lon)
        ) {
          minLat = Math.min(minLat, point.lat);
          maxLat = Math.max(maxLat, point.lat);
          minLon = Math.min(minLon, point.lon);
          maxLon = Math.max(maxLon, point.lon);
          hasValidBounds = true;
        }
      }
    }
  }

  return { minLat, maxLat, minLon, maxLon, hasValidBounds };
}

/**
 * Fügt Padding zu Bounds hinzu und begrenzt auf Osnabrücker Stadtgebiet
 *
 * Warum Padding?
 * - Gärten kleben nicht am Kartenrand (bessere UX)
 * - Mehr Kontext um die Gärten herum
 *
 * Warum Begrenzung auf Osnabrück?
 * - Verhindert, dass Karte zu weit rauszoomt
 * - Fokus bleibt auf relevantem Gebiet
 */
export function applyBoundsPadding(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  paddingPercent: number = 0.1
): [[number, number], [number, number]] {
  // Füge Padding hinzu (in Grad)
  const latPadding = (maxLat - minLat) * paddingPercent;
  const lonPadding = (maxLon - minLon) * paddingPercent;

  // Begrenze auf Osnabrücker Stadtgebiet (verhindert zu weites Rauszoomen)
  const paddedMinLat = Math.max(OSNABRUECK_BOUNDS.south, minLat - latPadding);
  const paddedMaxLat = Math.min(OSNABRUECK_BOUNDS.north, maxLat + latPadding);
  const paddedMinLon = Math.max(OSNABRUECK_BOUNDS.west, minLon - lonPadding);
  const paddedMaxLon = Math.min(OSNABRUECK_BOUNDS.east, maxLon + lonPadding);

  return [
    [paddedMinLat, paddedMinLon],
    [paddedMaxLat, paddedMaxLon],
  ];
}

/**
 * Validates if a coordinate is valid
 */
export function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Calculates the center point of a geometry
 */
export function calculateGeometryCenter(
  geometry: Array<{ lat: number; lon: number }>
): { lat: number; lon: number } | null {
  if (!geometry || geometry.length === 0) return null;

  const validPoints = geometry.filter((p) => isValidCoordinate(p.lat, p.lon));
  if (validPoints.length === 0) return null;

  const centerLat = validPoints.reduce((sum, p) => sum + p.lat, 0) / validPoints.length;
  const centerLon = validPoints.reduce((sum, p) => sum + p.lon, 0) / validPoints.length;

  return { lat: centerLat, lon: centerLon };
}
