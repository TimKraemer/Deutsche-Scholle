import { useEffect, useMemo, useState } from "react";
import type { Garden } from "../types/garden";
import { ON_REQUEST } from "../types/garden";
import {
  formatCurrency,
  formatDate,
  formatGardenValue,
  formatLastUpdate,
} from "../utils/formatting";
import {
  filterAvailableGardens,
  loadSortConfig,
  type SortConfig,
  type SortDirection,
  type SortOption,
  saveSortConfig,
  sortGardens,
} from "../utils/gardenSort";
import GardenFilters from "./GardenFilters";

const SORT_BUTTONS: { field: SortOption; label: string; title: string }[] = [
  { field: "number", label: "Nr.", title: "Nach Gartennummer" },
  { field: "availableFrom", label: "Frei ab", title: "Nach Verfügbarkeitsdatum" },
  { field: "size", label: "Größe", title: "Nach Größe" },
  { field: "valuation", label: "Preis", title: "Nach Preis" },
];

interface GardenListProps {
  gardens: Garden[];
  changedAt?: string | null; // Datum der letzten Änderung der Vereinsliste
  isLoading?: boolean;
  hasError?: boolean;
  onGardenClick: (gardenNumber: string) => void;
  hoveredGardenNumber?: string | null;
  onGardenHover?: (gardenNumber: string | null) => void;
  onFilteredGardensChange?: (filteredGardens: Garden[]) => void;
}

export default function GardenList({
  gardens,
  changedAt,
  isLoading = false,
  hasError = false,
  onGardenClick,
  hoveredGardenNumber,
  onGardenHover,
  onFilteredGardensChange,
}: GardenListProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(loadSortConfig);

  // Gleiches Feld erneut angeklickt: Richtung wechseln
  const handleSortChange = (field: SortOption) => {
    setSortConfig((prev) => {
      const direction: SortDirection =
        prev.field === field && prev.direction === "asc" ? "desc" : "asc";
      const config = { field, direction };
      saveSortConfig(config);
      return config;
    });
  };

  // Filtere freie Gärten (availableFrom gesetzt und nicht leer)
  const availableGardens = useMemo(() => filterAvailableGardens(gardens), [gardens]);

  // Gefilterte Gärten (nach Filter-Kriterien)
  const [filteredGardens, setFilteredGardens] = useState<Garden[]>(availableGardens);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Informiere Parent über gefilterte Gärten
  useEffect(() => {
    onFilteredGardensChange?.(filteredGardens);
  }, [filteredGardens]);

  // Sortiere nach ausgewählter Option und Richtung
  const sortedGardens = useMemo(() => {
    return sortGardens(filteredGardens, sortConfig.field, sortConfig.direction);
  }, [filteredGardens, sortConfig]);

  // Prüfe ob keine Ergebnisse wegen Filterung vorhanden sind
  const hasNoResults = sortedGardens.length === 0;
  const isFiltered = hasActiveFilters && availableGardens.length > 0;

  return (
    <div className="bg-scholle-bg-container rounded-lg border border-scholle-border shadow-xs flex flex-col lg:h-full lg:min-h-0">
      <div className="bg-scholle-green text-white px-4 py-3 rounded-t-lg shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Freie Gärten</h2>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-col">
            <p className="text-sm text-white/90">
              {sortedGardens.length}{" "}
              {sortedGardens.length === 1 ? "Garten verfügbar" : "Gärten verfügbar"}
            </p>
            {changedAt && (
              <p className="text-xs text-white/70 mt-0.5">Stand: {formatLastUpdate(changedAt)}</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {SORT_BUTTONS.map(({ field, label, title }) => {
              const isActive = sortConfig.field === field;
              const direction = isActive ? sortConfig.direction : "asc";
              return (
                <button
                  key={field}
                  onClick={() => handleSortChange(field)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                    isActive
                      ? "bg-white text-scholle-green"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                  title={`${title} sortieren (${direction === "asc" ? "aufsteigend" : "absteigend"})`}
                >
                  <span>{label}</span>
                  {isActive && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={direction === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter erst nach dem Laden, sonst berechnet er seine Grenzen aus der leeren Liste */}
      {!isLoading && (
        <GardenFilters
          gardens={availableGardens}
          onFilterChange={setFilteredGardens}
          onFilterActiveChange={setHasActiveFilters}
        />
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {hasNoResults ? (
          <div className="p-6 text-center">
            {isLoading ? (
              <p className="text-scholle-text-light">Freie Gärten werden geladen…</p>
            ) : hasError ? (
              <p className="text-scholle-text-light">
                Die Liste der freien Gärten konnte gerade nicht geladen werden.
              </p>
            ) : isFiltered ? (
              <div className="space-y-2">
                <p className="text-scholle-text-light font-medium">
                  Unter den aktuellen Filtereinstellungen wurden keine Gärten gefunden.
                </p>
                <p className="text-sm text-scholle-text-light">
                  Bitte passen Sie die Filter an, um weitere Ergebnisse zu sehen.
                </p>
              </div>
            ) : (
              <p className="text-scholle-text-light">Aktuell sind keine freien Gärten verfügbar.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-scholle-border">
            {sortedGardens.map((garden) => {
              const isHovered = hoveredGardenNumber === garden.number;
              return (
                <button
                  key={garden.id}
                  type="button"
                  onClick={() => onGardenClick(garden.number)}
                  onMouseEnter={() => onGardenHover?.(garden.number)}
                  onMouseLeave={() => onGardenHover?.(null)}
                  className={`w-full text-left p-4 transition-colors focus:outline-hidden focus:ring-2 focus:ring-scholle-green focus:ring-inset relative z-10 ${
                    isHovered
                      ? "bg-scholle-green/10 border-l-4 border-l-scholle-green"
                      : "hover:bg-scholle-bg-light"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-semibold text-scholle-text">
                          Garten {garden.number}
                        </span>
                      </div>
                      <div className="text-sm text-scholle-text-light space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{garden.parcel}</span>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <span>{garden.size} m²</span>
                          <span className="text-scholle-green font-medium">
                            Frei ab {formatDate(garden.availableFrom)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap pt-1">
                          <span className="font-medium text-scholle-text">
                            Wert:{" "}
                            {garden.valuation === ON_REQUEST ? (
                              <span
                                title="nach Vereinbarung"
                                className="underline decoration-dotted cursor-help"
                              >
                                n.V.
                              </span>
                            ) : (
                              formatGardenValue(garden.valuation)
                            )}
                          </span>
                          {garden.valueReduction === ON_REQUEST ? (
                            <span
                              title="nach Vereinbarung"
                              className="text-red-600 font-medium underline decoration-dotted cursor-help"
                            >
                              n.V.
                            </span>
                          ) : garden.valueReduction > 0 ? (
                            <span className="text-red-600 font-medium">
                              -{formatCurrency(garden.valueReduction)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-scholle-text-light shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
