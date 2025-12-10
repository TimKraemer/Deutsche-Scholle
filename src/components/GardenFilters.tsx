import { Checkbox, FormControlLabel, Slider } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type { Garden } from "../types/garden";
import { formatCurrency } from "../utils/formatting";
import {
  applyGardenFilters,
  type FilterValues,
  loadFiltersFromStorage,
  saveFiltersToStorage,
} from "../utils/gardenFilters";

interface GardenFiltersProps {
  gardens: Garden[];
  onFilterChange: (filteredGardens: Garden[]) => void;
  onFilterActiveChange?: (isActive: boolean) => void;
}

/**
 * Berechne Min/Max Werte aus den Daten für Filter-Slider
 *
 * Gibt sowohl echte Min/Max-Werte (für Slider-Grenzen) als auch gerundete Werte (für Initialisierung) zurück
 *
 * Warum zwei Sets von Werten?
 * - Echte Min/Max: Slider-Grenzen entsprechen exakt den Datenbank-Werten
 * - Gerundete Werte: Initialisierung der Filter auf sinnvolle Schritte (50€/10m²) für bessere UX
 */
const calculateRanges = (gardens: Garden[]) => {
  if (gardens.length === 0) {
    // Fallback-Werte wenn keine Gärten vorhanden (z.B. alle gefiltert)
    return {
      minPrice: 0,
      maxPrice: 1200,
      minSize: 350,
      maxSize: 450,
      // Gerundete Werte für Initialisierung (gleich wie echte Werte bei Fallback)
      defaultMinPrice: 0,
      defaultMaxPrice: 1200,
      defaultMinSize: 350,
      defaultMaxSize: 450,
    };
  }

  const prices = gardens.map((g) => g.valuation).filter((p) => p >= 0);
  const sizes = gardens.map((g) => g.size).filter((s) => s > 0);

  // Echte Min/Max-Werte aus der Datenbank (für Slider-Grenzen)
  const realMinPrice = Math.min(...prices, 0);
  const realMaxPrice = Math.max(...prices, 0);
  const realMinSize = Math.min(...sizes);
  const realMaxSize = Math.max(...sizes);

  // Gerundete Werte für Initialisierung (auf 50€/10m² Schritte)
  // WICHTIG: Gerundete Werte dürfen nicht über die echten Maximalwerte hinausgehen
  // und nicht unter die echten Minimalwerte fallen
  const defaultMinPrice = Math.max(Math.floor(realMinPrice / 50) * 50, realMinPrice); // Begrenze auf echten Minimalwert
  const defaultMaxPrice = Math.min(Math.ceil(realMaxPrice / 50) * 50, realMaxPrice); // Begrenze auf echten Maximalwert
  const defaultMinSize = Math.max(Math.floor(realMinSize / 10) * 10, realMinSize); // Begrenze auf echten Minimalwert
  const defaultMaxSize = Math.min(Math.ceil(realMaxSize / 10) * 10, realMaxSize); // Begrenze auf echten Maximalwert

  return {
    // Echte Min/Max-Werte für Slider-Grenzen (exakt aus der Datenbank)
    minPrice: Math.max(0, realMinPrice),
    maxPrice: realMaxPrice, // Echter Maximalwert aus der Datenbank
    minSize: realMinSize, // Echter Minimalwert aus der Datenbank
    maxSize: realMaxSize, // Echter Maximalwert aus der Datenbank
    // Gerundete Werte für Initialisierung (auf 50€/10m² Schritte, aber innerhalb der echten Min/Max-Werte)
    defaultMinPrice: Math.max(0, defaultMinPrice), // Bereits auf echten Minimalwert begrenzt
    defaultMaxPrice: defaultMaxPrice, // Bereits auf echten Maximalwert begrenzt
    defaultMinSize: defaultMinSize, // Bereits auf echten Minimalwert begrenzt
    defaultMaxSize: defaultMaxSize, // Bereits auf echten Maximalwert begrenzt
  };
};

export default function GardenFilters({
  gardens,
  onFilterChange,
  onFilterActiveChange,
}: GardenFiltersProps) {
  const ranges = useMemo(() => calculateRanges(gardens), [gardens]);

  // Lade Filter-Werte aus localStorage oder verwende gerundete Standard-Werte
  const [filters, setFilters] = useState<FilterValues>(() => {
    const loaded = loadFiltersFromStorage({
      minPrice: ranges.defaultMinPrice,
      maxPrice: ranges.defaultMaxPrice,
      minSize: ranges.defaultMinSize,
      maxSize: ranges.defaultMaxSize,
    });
    // Stelle sicher, dass Filter-Werte innerhalb der aktuellen Ranges liegen
    return {
      minPrice: Math.max(ranges.minPrice, Math.min(ranges.maxPrice, loaded.minPrice)),
      maxPrice: Math.min(ranges.maxPrice, Math.max(ranges.minPrice, loaded.maxPrice)),
      minSize: Math.max(ranges.minSize, Math.min(ranges.maxSize, loaded.minSize)),
      maxSize: Math.min(ranges.maxSize, Math.max(ranges.minSize, loaded.maxSize)),
      onlyAvailableNow: loaded.onlyAvailableNow,
    };
  });

  // Update filter ranges when gardens change
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      minPrice: Math.max(ranges.minPrice, Math.min(ranges.maxPrice, prev.minPrice)),
      maxPrice: Math.min(ranges.maxPrice, Math.max(ranges.minPrice, prev.maxPrice)),
      minSize: Math.max(ranges.minSize, Math.min(ranges.maxSize, prev.minSize)),
      maxSize: Math.min(ranges.maxSize, Math.max(ranges.minSize, prev.maxSize)),
    }));
  }, [ranges]);

  // Speichere Filter-Werte in localStorage wenn sie sich ändern
  useEffect(() => {
    saveFiltersToStorage(filters);
  }, [filters]);

  const [isExpanded, setIsExpanded] = useState(false);

  // Wende Filter an (verwendet gemeinsame Utility-Funktion)
  const filteredGardens = useMemo(() => {
    return applyGardenFilters(gardens, filters);
  }, [gardens, filters]);

  useEffect(() => {
    onFilterChange(filteredGardens);
  }, [filteredGardens]);

  const resetFilters = () => {
    // Beim Zurücksetzen werden gerundete Standard-Werte verwendet (nicht echte Min/Max)
    setFilters({
      minPrice: ranges.defaultMinPrice,
      maxPrice: ranges.defaultMaxPrice,
      minSize: ranges.defaultMinSize,
      maxSize: ranges.defaultMaxSize,
      onlyAvailableNow: false,
    });
  };

  const hasActiveFilters = useMemo(
    () =>
      filters.minPrice !== ranges.defaultMinPrice ||
      filters.maxPrice !== ranges.defaultMaxPrice ||
      filters.minSize !== ranges.defaultMinSize ||
      filters.maxSize !== ranges.defaultMaxSize ||
      filters.onlyAvailableNow,
    [filters, ranges]
  );

  // Informiere Parent über Filter-Status
  useEffect(() => {
    onFilterActiveChange?.(hasActiveFilters);
  }, [hasActiveFilters]);

  return (
    <div className="bg-scholle-bg-light border-b border-scholle-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-scholle-bg-container transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-scholle-green"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span className="font-semibold text-scholle-text">Filter</span>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <span className="text-xs bg-scholle-green text-white px-2 py-0.5 rounded-full animate-pulse">
              Aktiv
            </span>
          )}
          <svg
            className={`w-5 h-5 text-scholle-text-light transition-transform duration-300 ease-in-out ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out relative z-0 ${
          isExpanded
            ? "max-h-[800px] opacity-100 translate-y-0"
            : "max-h-0 opacity-0 -translate-y-2"
        }`}
      >
        <div
          className={`px-4 pb-4 space-y-6 pt-4 mx-2 mb-2 rounded-lg bg-white border-2 border-scholle-green/20 shadow-sm transition-opacity duration-300 ${
            isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Preis-Filter */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-scholle-text-light mb-2">
              Preis (Wertermittlung)
            </label>
            <Slider
              value={[filters.minPrice, filters.maxPrice]}
              onChange={(_, newValue) => {
                const [min, max] = newValue as number[];
                setFilters({ ...filters, minPrice: min, maxPrice: max });
              }}
              min={ranges.minPrice}
              max={ranges.maxPrice}
              step={50}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => formatCurrency(value)}
              sx={{
                color: "#6B8F2D", // scholle-green
                "& .MuiSlider-thumb": {
                  backgroundColor: "#6B8F2D",
                  border: "2px solid white",
                  "&:hover": {
                    boxShadow: "0 0 0 8px rgba(107, 143, 45, 0.16)",
                  },
                },
                "& .MuiSlider-track": {
                  backgroundColor: "#6B8F2D",
                },
                "& .MuiSlider-rail": {
                  backgroundColor: "#E5E7EB", // scholle-border
                },
                "& .MuiSlider-valueLabel": {
                  backgroundColor: "#6B8F2D",
                },
              }}
            />
            <div className="flex items-center justify-between text-sm text-scholle-text">
              <span>{formatCurrency(filters.minPrice)}</span>
              <span>{formatCurrency(filters.maxPrice)}</span>
            </div>
          </div>

          {/* Größen-Filter */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-scholle-text-light mb-2">
              Größe
            </label>
            <Slider
              value={[filters.minSize, filters.maxSize]}
              onChange={(_, newValue) => {
                const [min, max] = newValue as number[];
                setFilters({ ...filters, minSize: min, maxSize: max });
              }}
              min={ranges.minSize}
              max={ranges.maxSize}
              step={10}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value} m²`}
              sx={{
                color: "#6B8F2D", // scholle-green
                "& .MuiSlider-thumb": {
                  backgroundColor: "#6B8F2D",
                  border: "2px solid white",
                  "&:hover": {
                    boxShadow: "0 0 0 8px rgba(107, 143, 45, 0.16)",
                  },
                },
                "& .MuiSlider-track": {
                  backgroundColor: "#6B8F2D",
                },
                "& .MuiSlider-rail": {
                  backgroundColor: "#E5E7EB", // scholle-border
                },
                "& .MuiSlider-valueLabel": {
                  backgroundColor: "#6B8F2D",
                },
              }}
            />
            <div className="flex items-center justify-between text-sm text-scholle-text">
              <span>{filters.minSize} m²</span>
              <span>{filters.maxSize} m²</span>
            </div>
          </div>

          {/* Nur frei ab sofort Checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={filters.onlyAvailableNow}
                onChange={(e) => setFilters({ ...filters, onlyAvailableNow: e.target.checked })}
                sx={{
                  color: "#6B8F2D", // scholle-green
                  "&.Mui-checked": {
                    color: "#6B8F2D", // scholle-green
                  },
                  "&:hover": {
                    backgroundColor: "rgba(107, 143, 45, 0.08)",
                  },
                }}
              />
            }
            label="Nur frei ab sofort"
            className="text-sm font-medium text-scholle-text"
          />

          {/* Reset Button */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="w-full px-4 py-2 bg-scholle-bg-light hover:bg-scholle-border text-scholle-text rounded-lg transition-colors text-sm font-medium"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
