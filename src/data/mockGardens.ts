import { type Garden, ON_REQUEST } from "../types/garden";

/**
 * Mock-Daten für Gärten
 */
export const mockGardens: Garden[] = [
  {
    id: "garden-1027",
    number: "1027",
    parcel: "Klostergärten 1",
    size: 375,
    availableFrom: "2027-01-01",
    valuation: 865,
    valueReduction: 292,
  },
  {
    id: "garden-1057",
    number: "1057",
    parcel: "Klostergärten 2",
    size: 375,
    availableFrom: "sofort",
    valuation: 0,
    valueReduction: 0,
  },
  {
    id: "garden-21",
    number: "21",
    parcel: "Fleckendorfer Welle 1",
    size: 619,
    availableFrom: "2026-09-01",
    valuation: 0,
    valueReduction: 0,
  },
  {
    id: "garden-384",
    number: "384",
    parcel: "Johannisgärten 4",
    size: 404,
    availableFrom: "sofort",
    valuation: 0,
    valueReduction: ON_REQUEST,
  },
  {
    id: "garden-452",
    number: "452",
    parcel: "Johannisgärten 5",
    size: 405,
    availableFrom: "sofort",
    valuation: 0,
    valueReduction: 0,
  },
  {
    id: "garden-458",
    number: "458",
    parcel: "Johannisgärten 5",
    size: 405,
    availableFrom: "sofort",
    valuation: 1267,
    valueReduction: 150,
  },
  {
    id: "garden-465",
    number: "465",
    parcel: "Johannisgärten 6",
    size: 336,
    availableFrom: "2026-06-01",
    valuation: 0,
    valueReduction: 0,
  },
  {
    id: "garden-499",
    number: "499",
    parcel: "Johannisgärten 3",
    size: 405,
    availableFrom: "2027-01-01",
    valuation: 0,
    valueReduction: 0,
  },
  {
    id: "garden-731",
    number: "731",
    parcel: "Sternsche Wiese 2",
    size: 375,
    availableFrom: "sofort",
    valuation: 0,
    valueReduction: 450,
  },
  {
    id: "garden-735",
    number: "735",
    parcel: "Sternsche Wiese 2",
    size: 745,
    availableFrom: "sofort",
    valuation: 0,
    valueReduction: 1782,
  },
  {
    id: "garden-8a",
    number: "8a",
    parcel: "Fleckendorfer Welle 2",
    size: 345,
    availableFrom: "2026-07-01",
    valuation: 0,
    valueReduction: 0,
  },
];

/**
 * Datum der letzten Änderung in der Datenbank
 * Format: YYYY-MM-DD
 */
export const LAST_DB_UPDATE = "2026-06-04";

/**
 * Findet einen Garten anhand der Nummer in den Mock-Daten
 */
export function findGardenByNumber(number: string): Garden | undefined {
  return mockGardens.find((garden) => garden.number === number);
}
