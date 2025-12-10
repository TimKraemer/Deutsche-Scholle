import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { mockGardens } from "../data/mockGardens";
import type { CookiePreferences } from "../types/cookies";
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

export default function DebugPage() {
  const navigate = useNavigate();
  const [comparisons, setComparisons] = useState<GardenSizeComparison[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    const loadComparisons = async () => {
      if (!cookiePreferences.openStreetMap) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const results: GardenSizeComparison[] = [];

      // Lade alle Gärten aus OSM für bessere Performance
      let allOsmGardens: any[] = [];
      try {
        allOsmGardens = await loadAllGardens(false);
      } catch (error) {
        console.error("Error loading all gardens:", error);
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
            const singleOsmWay = await searchGardenByNumber(mockGarden.number, false);
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

      setComparisons(results);
      setIsLoading(false);
    };

    loadComparisons();
  }, [cookiePreferences.openStreetMap]);

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
        </div>

        {isLoading ? (
          <div className="bg-scholle-bg-container rounded-lg border border-scholle-border p-8 text-center">
            <p className="text-scholle-text-light">Lade Daten...</p>
          </div>
        ) : (
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
                        <td className="px-4 py-3 text-sm text-scholle-text-light">{comp.parcel}</td>
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
                  Mit OSM-Daten: {comparisons.filter((c) => c.hasOsmData).length} | Ohne OSM-Daten:{" "}
                  {comparisons.filter((c) => !c.hasOsmData).length}
                </div>
                <div className="text-xs text-scholle-text-light/70">
                  Klicken Sie auf eine Zeile, um zur Detailseite zu navigieren
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
