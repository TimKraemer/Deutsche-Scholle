export type WaterConnectionType = 'brunnen' | 'wasserleitung' | 'brunnen-aussen' | 'kein';

export interface Garden {
  id: string;
  number: string;
  parcel: string;
  size: number; // m² (aus Datenbank)
  osmSize?: number; // m² (berechnet aus OSM-Geometrie)
  availableFrom: string; // Datum
  valuation: number; // €
  valueReduction: number; // €
  hasElectricity: boolean;
  waterConnection: WaterConnectionType;
  coordinates?: [number, number]; // [lat, lng] - optional, wird aus OSM berechnet
  bounds?: [[number, number], [number, number]]; // für Umrisse
  osmWayId?: number; // OSM Way ID für Plot 1050: 1412612288
}

