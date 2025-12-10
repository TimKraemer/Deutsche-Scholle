/**
 * Shared constants used across the application
 */

// Osnabrück city bounds for map restrictions
export const OSNABRUECK_BOUNDS = {
  north: 52.32,
  south: 52.2,
  east: 8.1,
  west: 7.95,
} as const;

// Initial map center coordinates (Deutsche Scholle Osnabrück)
export const INITIAL_MAP_CENTER: [number, number] = [52.2568, 8.02725];
export const INITIAL_MAP_ZOOM = 15;

// Zoom level for showing garden labels
export const MIN_ZOOM_FOR_LABELS = 17;

// Google Maps configuration
export const GOOGLE_MAPS_CONFIG = {
  MAX_ZOOM: 23,
  MIN_ZOOM: 12,
  TILT: 45,
  DEFAULT_ZOOM: 15,
  GARDEN_ZOOM: 18,
} as const;
