import { expect, test } from "bun:test";
import { ON_REQUEST } from "../types/garden";
import { parseFreeGardens } from "./freeGardens";
import { applyGardenFilters, calculateRanges, isAvailableNow } from "./gardenFilters";
import { osmWayToGarden } from "./osm";

const COLUMNS = ["Nr.", "Parzelle", "Größe", "frei ab", "Wertermittlung", "Wertminderung"];

const gardens = parseFreeGardens({
  fetchedAt: "2026-10-13T00:00:00+00:00",
  changedAt: "2026-10-13",
  columns: COLUMNS,
  rows: [
    ["279*", "Marienfelder Kamp", "374", "sofort", "591,44 €", "1.200,00 €"],
    ["403", "Burenkamp 1", "520", "01.09.2026", "", ""],
    ["156", "Fleckendorfer Welle 7", "ca. 400", "01.01.2999", "", ""],
  ],
});

test("parseFreeGardens liest Nummer, Beträge, Datum und Größe", () => {
  expect(gardens[0]).toMatchObject({
    number: "279",
    size: 374,
    availableFrom: "sofort",
    valuation: 591.44,
    valueReduction: 1200,
  });
  expect(gardens[1]).toMatchObject({ availableFrom: "2026-09-01", valuation: ON_REQUEST });
  expect(gardens[2].size).toBe(0);
});

test("isAvailableNow: sofort und vergangene Daten sind frei, künftige nicht", () => {
  expect(isAvailableNow("sofort", "2026-10-13")).toBe(true);
  expect(isAvailableNow("2026-09-01", "2026-10-13")).toBe(true);
  expect(isAvailableNow("2026-10-13", "2026-10-13")).toBe(true);
  expect(isAvailableNow("2026-10-14", "2026-10-13")).toBe(false);
});

test("Grenzen sind nach außen gerundet und lassen jeden Garten durch", () => {
  const ranges = calculateRanges(gardens);
  expect(ranges).toEqual({ minPrice: 0, maxPrice: 600, minSize: 370, maxSize: 520 });
  const all = applyGardenFilters(gardens, { ...ranges, onlyAvailableNow: false });
  // Auch der Garten mit unlesbarer Größe (0) bleibt sichtbar
  expect(all.map((g) => g.number)).toEqual(["279", "403", "156"]);
});

test('"Nur frei ab sofort" behält Gärten mit vergangenem Datum', () => {
  const now = applyGardenFilters(gardens, { ...calculateRanges(gardens), onlyAvailableNow: true });
  expect(now.map((g) => g.number)).toEqual(["279", "403"]);
});

test("osmWayToGarden übernimmt die Parzelle der Vereinsliste vor der aus OSM", () => {
  const way = {
    type: "way" as const,
    id: 1,
    tags: { ref: "403" },
    geometry: [
      { lat: 52.256, lon: 8.027 },
      { lat: 52.256, lon: 8.0272 },
      { lat: 52.2562, lon: 8.0272 },
    ],
  };
  expect(osmWayToGarden(way, gardens[1], "Johannisgärten 1")?.parcel).toBe("Burenkamp 1");
  expect(osmWayToGarden(way, undefined, "Johannisgärten 1")?.parcel).toBe("Johannisgärten 1");
});
