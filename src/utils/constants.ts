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
  DEFAULT_ZOOM: 15,
  GARDEN_ZOOM: 18,
} as const;

// Fotorealistische 3D-Ansicht (Google Map3DElement)
// Ersetzt die 45°-Luftbilder, die Google mit Maps JS API 3.65 abgeschaltet hat.
export const GOOGLE_3D_CONFIG = {
  TILT: 55, // Neigung der Kamera in Grad (0 = senkrecht von oben)
  GARDEN_RANGE: 160, // Abstand der Kamera zum Garten in Metern
  OVERVIEW_RANGE: 1400, // Abstand der Kamera in der Übersicht in Metern
  // Geländehöhe über NN, falls für einen Garten keine Höhe im Snapshot steht.
  // Die Kamera zielt auf einen Punkt in absoluter Höhe, bei 0 läge er unter der Erde.
  DEFAULT_ELEVATION: 75,
} as const;
