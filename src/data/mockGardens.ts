import type { Garden } from "../types/garden";

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
    id: "garden-249",
    number: "249",
    parcel: "Marienfelder Kamp",
    size: 416,
    availableFrom: "",
    valuation: 0,
    valueReduction: 300,
  },
  {
    id: "garden-272",
    number: "272",
    parcel: "Marienfelder Kamp",
    size: 382,
    availableFrom: "sofort",
    valuation: 0,
    valueReduction: 1525,
  },
  {
    id: "garden-274",
    number: "274",
    parcel: "Marienfelder Kamp",
    size: 384,
    availableFrom: "2026-01-01",
    valuation: 412,
    valueReduction: 75,
  },
  {
    id: "garden-278",
    number: "278",
    parcel: "Marienfelder Kamp",
    size: 381,
    availableFrom: "sofort",
    valuation: 0,
    valueReduction: 1521,
  },
  {
    id: "garden-293",
    number: "293",
    parcel: "Jostdiek",
    size: 397,
    availableFrom: "sofort",
    valuation: 223,
    valueReduction: 340,
  },
  {
    id: "garden-427",
    number: "427",
    parcel: "Burenkamp 1",
    size: 387,
    availableFrom: "sofort",
    valuation: 1007,
    valueReduction: 255,
  },
  {
    id: "garden-450",
    number: "450",
    parcel: "Johannisgärten 5",
    size: 405,
    availableFrom: "sofort",
    valuation: 0,
    valueReduction: 1055,
  },
  {
    id: "garden-491",
    number: "491",
    parcel: "Johannisgärten 5",
    size: 400,
    availableFrom: "sofort",
    valuation: 0,
    valueReduction: 936,
  },
  {
    id: "garden-496",
    number: "496",
    parcel: "Johannisgärten 5",
    size: 400,
    availableFrom: "sofort",
    valuation: 525,
    valueReduction: 630,
  },
  {
    id: "garden-531",
    number: "531",
    parcel: "Johannisgärten 4",
    size: 406,
    availableFrom: "sofort",
    valuation: 1164,
    valueReduction: 135,
  },
];

/**
 * Datum der letzten Änderung in der Datenbank
 * Format: YYYY-MM-DD
 */
export const LAST_DB_UPDATE = "2025-11-22";

/**
 * Findet einen Garten anhand der Nummer in den Mock-Daten
 */
export function findGardenByNumber(number: string): Garden | undefined {
  return mockGardens.find((garden) => garden.number === number);
}
