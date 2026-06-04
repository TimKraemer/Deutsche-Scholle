import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { mockGardens } from "../data/mockGardens";
import type { CookiePreferences } from "../types/cookies";
import { CacheKeys, getFromCache, setCache } from "../utils/cache";
import { loadCookiePreferences } from "../utils/cookies";
import { loadAllGardens, osmWayToGarden, searchGardenByNumber } from "../utils/osm";

interface GardenSizeComparison {
  number: string;
  dbSize: number;
  osmSize: number | null;
  difference: number | null;
  percentageDiff: number | null;
  hasOsmData: boolean;
  parcel: string;
}

type SortColumn =
  | "number"
  | "parcel"
  | "dbSize"
  | "osmSize"
  | "difference"
  | "percentageDiff"
  | "status";
type SortDirection = "asc" | "desc";

/** Eine Gartennummer (ref), die in OSM mehrfach vorkommt */
interface DuplicateOsmGarden {
  ref: string;
  wayIds: number[];
}

/** Eine erwartete Gartennummer, die in OSM nicht gefunden wurde */
interface MissingOsmGarden {
  number: string;
  parcel: string;
}

// Erwarteter Bereich der Gartennummern im Verein: 1 bis 1058 (durchgehend).
// Wird genutzt, um zu prüfen, welche Nummern noch nicht in OSM erfasst sind.
const GARDEN_NUMBER_MIN = 1;
const GARDEN_NUMBER_MAX = 1058;

// Im Cache gespeicherte Auswertung der Debug-Seite.
// Wird einmal berechnet und nur auf Knopfdruck aktualisiert.
interface DebugResults {
  comparisons: GardenSizeComparison[];
  duplicates: DuplicateOsmGarden[];
  missingInOsm: MissingOsmGarden[];
  generatedAt: number;
}

// 7 Tage TTL: Auswertung ist aufwändig und ändert sich selten.
const DEBUG_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

export default function DebugPage() {
  const navigate = useNavigate();
  const [comparisons, setComparisons] = useState<GardenSizeComparison[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateOsmGarden[]>([]);
  const [missingInOsm, setMissingInOsm] = useState<MissingOsmGarden[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("number");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences>({
    googleMaps: false,
    openStreetMap: false,
  });

  useEffect(() => {
    const preferences = loadCookiePreferences();
    setCookiePreferences(preferences);
  }, []);

  // Wendet ein (gecachtes oder neu berechnetes) Ergebnis auf den State an.
  const applyResults = useCallback((results: DebugResults) => {
    setComparisons(results.comparisons);
    setDuplicates(results.duplicates);
    setMissingInOsm(results.missingInOsm);
    setGeneratedAt(results.generatedAt);
  }, []);

  // Berechnet die komplette Auswertung neu (lädt OSM-Daten).
  // forceRefresh=true umgeht den OSM-Cache und holt frische Daten.
  const computeResults = useCallback(async (forceRefresh: boolean): Promise<DebugResults> => {
    const results: GardenSizeComparison[] = [];

    // Lade alle Gärten aus OSM für bessere Performance
    let allOsmGardens: any[] = [];
    try {
      allOsmGardens = await loadAllGardens(forceRefresh);
    } catch (error) {
      console.error("Error loading all gardens:", error);
    }

    // Doppelte Gartennummern in OSM finden:
    // Gruppiere alle OSM-Ways nach ihrer ref (Gartennummer) und sammle die Way-IDs.
    // Eine ref, die mehr als einer Way-ID zugeordnet ist, kommt doppelt vor und
    // führt in der Karte/Suche zu Mehrdeutigkeiten.
    const refToWayIds = new Map<string, number[]>();
    for (const osm of allOsmGardens) {
      const ref = osm.tags?.ref;
      if (!ref) {
        continue;
      }
      const existing = refToWayIds.get(ref);
      if (existing) {
        existing.push(osm.id);
      } else {
        refToWayIds.set(ref, [osm.id]);
      }
    }
    const duplicateGardens: DuplicateOsmGarden[] = [];
    for (const [ref, wayIds] of refToWayIds) {
      if (wayIds.length > 1) {
        duplicateGardens.push({ ref, wayIds });
      }
    }
    duplicateGardens.sort((a, b) => (parseInt(a.ref, 10) || 0) - (parseInt(b.ref, 10) || 0));

    // Erwartete Gartennummern, die in OSM nicht gefunden werden:
    // Erwartet wird der durchgehende Bereich GARDEN_NUMBER_MIN..GARDEN_NUMBER_MAX.
    // Sammle alle in OSM vorhandenen refs und prüfe, welche Nummern fehlen.
    const osmRefs = new Set<string>();
    for (const osm of allOsmGardens) {
      if (osm.tags?.ref) {
        osmRefs.add(osm.tags.ref);
      }
    }
    // Parzelle aus den Mock-Daten ergänzen, falls vorhanden (rein informativ).
    const numberToParcel = new Map<string, string>();
    for (const mockGarden of mockGardens) {
      if (mockGarden.parcel) {
        numberToParcel.set(mockGarden.number, mockGarden.parcel);
      }
    }
    const missingGardens: MissingOsmGarden[] = [];
    for (let n = GARDEN_NUMBER_MIN; n <= GARDEN_NUMBER_MAX; n++) {
      const number = String(n);
      if (!osmRefs.has(number)) {
        missingGardens.push({
          number,
          parcel: numberToParcel.get(number) || "-",
        });
      }
    }

    // Verarbeite jeden Garten aus der Datenbank
    for (const mockGarden of mockGardens) {
      const dbSize = mockGarden.size || 0;

      // Suche nach OSM-Daten für diesen Garten
      const osmWay = allOsmGardens.find((osm) => osm.tags?.ref === mockGarden.number) || null;

      if (osmWay) {
        // Kombiniere OSM-Daten mit Mock-Daten
        const garden = osmWayToGarden(osmWay, mockGarden);

        if (garden && garden.osmSize !== undefined && garden.osmSize !== null) {
          const osmSize = garden.osmSize;
          const difference = osmSize - dbSize;
          const percentageDiff = dbSize > 0 ? (difference / dbSize) * 100 : null;

          results.push({
            number: mockGarden.number,
            dbSize,
            osmSize,
            difference,
            percentageDiff,
            hasOsmData: true,
            parcel: mockGarden.parcel || "-",
          });
        } else {
          results.push({
            number: mockGarden.number,
            dbSize,
            osmSize: null,
            difference: null,
            percentageDiff: null,
            hasOsmData: false,
            parcel: mockGarden.parcel || "-",
          });
        }
      } else {
        // Fallback: Versuche einzelne Suche
        try {
          const singleOsmWay = await searchGardenByNumber(mockGarden.number, forceRefresh);
          if (singleOsmWay) {
            const garden = osmWayToGarden(singleOsmWay, mockGarden);

            if (garden && garden.osmSize !== undefined && garden.osmSize !== null) {
              const osmSize = garden.osmSize;
              const difference = osmSize - dbSize;
              const percentageDiff = dbSize > 0 ? (difference / dbSize) * 100 : null;

              results.push({
                number: mockGarden.number,
                dbSize,
                osmSize,
                difference,
                percentageDiff,
                hasOsmData: true,
                parcel: mockGarden.parcel || "-",
              });
            } else {
              results.push({
                number: mockGarden.number,
                dbSize,
                osmSize: null,
                difference: null,
                percentageDiff: null,
                hasOsmData: false,
                parcel: mockGarden.parcel || "-",
              });
            }
          } else {
            results.push({
              number: mockGarden.number,
              dbSize,
              osmSize: null,
              difference: null,
              percentageDiff: null,
              hasOsmData: false,
              parcel: mockGarden.parcel || "-",
            });
          }
        } catch (error) {
          console.error(`Error loading garden ${mockGarden.number}:`, error);
          results.push({
            number: mockGarden.number,
            dbSize,
            osmSize: null,
            difference: null,
            percentageDiff: null,
            hasOsmData: false,
            parcel: mockGarden.parcel || "-",
          });
        }
      }
    }

    return {
      comparisons: results,
      duplicates: duplicateGardens,
      missingInOsm: missingGardens,
      generatedAt: Date.now(),
    };
  }, []);

  // Erzwingt eine Neuberechnung (Button "Aktualisieren") und schreibt in den Cache.
  const refresh = useCallback(async () => {
    if (!cookiePreferences.openStreetMap) {
      return;
    }
    setIsRefreshing(true);
    try {
      const results = await computeResults(true);
      setCache(CacheKeys.DEBUG_RESULTS, results, DEBUG_CACHE_TTL);
      applyResults(results);
    } catch (error) {
      console.error("Error refreshing debug results:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [cookiePreferences.openStreetMap, computeResults, applyResults]);

  // Initiales Laden: zeige gecachtes Ergebnis sofort, berechne nur falls kein Cache.
  useEffect(() => {
    if (!cookiePreferences.openStreetMap) {
      setIsLoading(false);
      return;
    }

    const cached = getFromCache<DebugResults>(CacheKeys.DEBUG_RESULTS);
    if (cached) {
      applyResults(cached);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    computeResults(false)
      .then((results) => {
        if (cancelled) {
          return;
        }
        setCache(CacheKeys.DEBUG_RESULTS, results, DEBUG_CACHE_TTL);
        applyResults(results);
      })
      .catch((error) => {
        console.error("Error loading debug results:", error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cookiePreferences.openStreetMap, computeResults, applyResults]);

  // Sortiere die Vergleiche
  const sortedComparisons = useMemo(() => {
    const sorted = [...comparisons];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "number": {
          const numA = parseInt(a.number, 10) || 0;
          const numB = parseInt(b.number, 10) || 0;
          comparison = numA - numB;
          break;
        }
        case "parcel":
          comparison = (a.parcel || "").localeCompare(b.parcel || "");
          break;
        case "dbSize":
          comparison = (a.dbSize || 0) - (b.dbSize || 0);
          break;
        case "osmSize": {
          const osmA = a.osmSize ?? -1;
          const osmB = b.osmSize ?? -1;
          comparison = osmA - osmB;
          break;
        }
        case "difference": {
          const diffA = a.difference ?? -Infinity;
          const diffB = b.difference ?? -Infinity;
          comparison = diffA - diffB;
          break;
        }
        case "percentageDiff": {
          const percA = a.percentageDiff ?? -Infinity;
          const percB = b.percentageDiff ?? -Infinity;
          comparison = percA - percB;
          break;
        }
        case "status":
          comparison = (a.hasOsmData ? 1 : 0) - (b.hasOsmData ? 1 : 0);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [comparisons, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleRowClick = (gardenNumber: string) => {
    navigate(`/${gardenNumber}`);
  };

  if (!cookiePreferences.openStreetMap) {
    return (
      <div className="min-h-screen bg-scholle-bg p-8">
        <div className="container mx-auto max-w-6xl">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">
              OpenStreetMap-Zustimmung erforderlich
            </h2>
            <p className="text-yellow-700">
              Bitte aktivieren Sie OpenStreetMap in den Cookie-Einstellungen, um die Debug-Ansicht
              zu verwenden.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-scholle-bg p-8">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-6">
          <button
            onClick={() => navigate("/")}
            className="text-scholle-blue hover:text-scholle-blue-dark transition-colors font-medium mb-4"
          >
            ← Zurück zur Übersicht
          </button>
          <h1 className="text-3xl font-bold text-scholle-text mb-2">
            Debug: Größenvergleich Datenbank vs. OSM
          </h1>
          <p className="text-scholle-text-light">
            Vergleich der Größenangaben aus der Datenbank mit den aus OSM-Geometrie berechneten
            Werten
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-lg bg-scholle-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-scholle-green-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? "Aktualisiere…" : "Aktualisieren"}
            </button>
            <span className="text-xs text-scholle-text-light">
              {generatedAt
                ? `Stand: ${new Date(generatedAt).toLocaleString("de-DE")} (aus Cache)`
                : "Noch keine Daten geladen"}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-scholle-bg-container rounded-lg border border-scholle-border p-8 text-center">
            <p className="text-scholle-text-light">Lade Daten...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Gartennummern, die in OSM nicht gefunden wurden */}
              <div className="bg-scholle-bg-container rounded-lg border border-scholle-border shadow-xs overflow-hidden">
                <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Nicht in OSM gefunden</h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/20">
                    {missingInOsm.length}
                  </span>
                </div>
                {missingInOsm.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-scholle-text-light text-center">
                    Alle erwarteten Gartennummern wurden in OSM gefunden.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {missingInOsm.map((g) => (
                        <button
                          key={g.number}
                          type="button"
                          onClick={() => handleRowClick(g.number)}
                          title={g.parcel !== "-" ? g.parcel : undefined}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                        >
                          {g.number}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="px-4 py-2 bg-scholle-bg-light border-t border-scholle-border text-xs text-scholle-text-light">
                  Erwartete Gartennummern ({GARDEN_NUMBER_MIN}–{GARDEN_NUMBER_MAX}) ohne OSM-Eintrag
                  (ref).
                </div>
              </div>

              {/* Gartennummern, die in OSM doppelt vorkommen */}
              <div className="bg-scholle-bg-container rounded-lg border border-scholle-border shadow-xs overflow-hidden">
                <div className="bg-amber-500 text-white px-4 py-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Doppelt in OSM</h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/20">
                    {duplicates.length}
                  </span>
                </div>
                {duplicates.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-scholle-text-light text-center">
                    Keine doppelten Gartennummern in OSM gefunden.
                  </p>
                ) : (
                  <ul className="divide-y divide-scholle-border">
                    {duplicates.map((d) => (
                      <li key={d.ref} className="flex items-center justify-between gap-3 px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleRowClick(d.ref)}
                          className="text-sm font-medium text-scholle-text hover:text-scholle-blue transition-colors"
                        >
                          {d.ref}
                        </button>
                        <span className="flex flex-wrap items-center justify-end gap-2">
                          <span className="text-xs text-scholle-text-light">
                            {d.wayIds.length}× —
                          </span>
                          {d.wayIds.map((id) => (
                            <a
                              key={id}
                              href={`https://www.openstreetmap.org/way/${id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-scholle-blue hover:text-scholle-blue-dark underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              way/{id}
                            </a>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="px-4 py-2 bg-scholle-bg-light border-t border-scholle-border text-xs text-scholle-text-light">
                  ref-Werte, die in OSM mehreren Ways zugeordnet sind.
                </div>
              </div>
            </div>

            <div className="bg-scholle-bg-container rounded-lg border border-scholle-border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-scholle-green text-white">
                    <tr>
                      <th
                        className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-scholle-green-dark select-none"
                        onClick={() => handleSort("number")}
                      >
                        <div className="flex items-center gap-2">
                          Gartennummer
                          {sortColumn === "number" && (
                            <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-scholle-green-dark select-none"
                        onClick={() => handleSort("parcel")}
                      >
                        <div className="flex items-center gap-2">
                          Parzelle
                          {sortColumn === "parcel" && (
                            <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-scholle-green-dark select-none"
                        onClick={() => handleSort("dbSize")}
                      >
                        <div className="flex items-center justify-end gap-2">
                          DB-Größe (m²)
                          {sortColumn === "dbSize" && (
                            <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-scholle-green-dark select-none"
                        onClick={() => handleSort("osmSize")}
                      >
                        <div className="flex items-center justify-end gap-2">
                          OSM-Größe (m²)
                          {sortColumn === "osmSize" && (
                            <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-scholle-green-dark select-none"
                        onClick={() => handleSort("difference")}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Differenz (m²)
                          {sortColumn === "difference" && (
                            <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-scholle-green-dark select-none"
                        onClick={() => handleSort("percentageDiff")}
                      >
                        <div className="flex items-center justify-end gap-2">
                          Abweichung (%)
                          {sortColumn === "percentageDiff" && (
                            <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-scholle-green-dark select-none"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Status
                          {sortColumn === "status" && (
                            <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-scholle-border">
                    {sortedComparisons.map((comp) => {
                      const hasLargeDiff =
                        comp.percentageDiff !== null && Math.abs(comp.percentageDiff) > 10;
                      const diffColor =
                        comp.difference === null
                          ? "text-scholle-text-light"
                          : comp.difference > 0
                            ? "text-green-600"
                            : comp.difference < 0
                              ? "text-red-600"
                              : "text-scholle-text";

                      return (
                        <tr
                          key={comp.number}
                          onClick={() => handleRowClick(comp.number)}
                          className={`hover:bg-scholle-bg-light cursor-pointer transition-colors ${hasLargeDiff ? "bg-yellow-50" : ""}`}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-scholle-text">
                            {comp.number}
                          </td>
                          <td className="px-4 py-3 text-sm text-scholle-text-light">
                            {comp.parcel}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-scholle-text">
                            {comp.dbSize > 0 ? comp.dbSize.toLocaleString("de-DE") : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-scholle-text">
                            {comp.osmSize !== null ? comp.osmSize.toLocaleString("de-DE") : "-"}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${diffColor}`}>
                            {comp.difference !== null
                              ? `${comp.difference > 0 ? "+" : ""}${comp.difference.toLocaleString("de-DE")}`
                              : "-"}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${diffColor}`}>
                            {comp.percentageDiff !== null
                              ? `${comp.percentageDiff > 0 ? "+" : ""}${comp.percentageDiff.toFixed(1)}%`
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {comp.hasOsmData ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                OSM gefunden
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Nicht in OSM
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 bg-scholle-bg-light border-t border-scholle-border">
                <div className="flex items-center justify-between text-sm text-scholle-text-light">
                  <div>Gesamt: {comparisons.length} Gärten</div>
                  <div>
                    Mit OSM-Daten: {comparisons.filter((c) => c.hasOsmData).length} | Ohne
                    OSM-Daten: {comparisons.filter((c) => !c.hasOsmData).length}
                  </div>
                  <div className="text-xs text-scholle-text-light/70">
                    Klicken Sie auf eine Zeile, um zur Detailseite zu navigieren
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
