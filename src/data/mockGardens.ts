import type { Garden } from '../types/garden';

/**
 * Mock-Daten für Gärten
 * Plot 1050 (OSM Way ID: 1412612288) als Beispiel
 */
export const mockGardens: Garden[] = [
  {
    id: 'garden-1050',
    number: '1050',
    parcel: 'Klostergärten 1',
    size: 375, // m²
    availableFrom: '2025-01-01',
    valuation: 1680, // €
    valueReduction: 45, // €
    hasElectricity: true,
    waterConnection: 'brunnen',
    osmWayId: 1412612288,
  },
];

/**
 * Findet einen Garten anhand der Nummer in den Mock-Daten
 */
export function findGardenByNumber(number: string): Garden | undefined {
  return mockGardens.find(garden => garden.number === number);
}

