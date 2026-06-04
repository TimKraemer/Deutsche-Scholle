export type WaterConnectionType = "brunnen" | "wasserleitung" | "brunnen-aussen" | "kein";

/**
 * Sonderwert "nach Vereinbarung": der Betrag steht noch nicht fest und wird
 * individuell vereinbart. Wird in der UI als "n.V." angezeigt.
 */
export const ON_REQUEST = "n.V." as const;

/** Geldbetrag in € oder "nach Vereinbarung" */
export type GardenValue = number | typeof ON_REQUEST;

export interface Garden {
  id: string;
  number: string;
  parcel: string;
  size: number; // m² (aus Datenbank)
  osmSize?: number; // m² (berechnet aus OSM-Geometrie)
  availableFrom: string; // Datum oder "sofort"
  valuation: GardenValue; // € oder "n.V."
  valueReduction: GardenValue; // € oder "n.V."
  hasElectricity?: boolean; // Optional: nur gesetzt wenn bekannt
  waterConnection?: WaterConnectionType; // Optional: nur gesetzt wenn bekannt
  coordinates?: [number, number]; // [lat, lng] - optional, wird aus OSM berechnet
  bounds?: [[number, number], [number, number]]; // für Umrisse
  osmWayId?: number; // OSM Way ID für Plot 1050: 1412612288
}
