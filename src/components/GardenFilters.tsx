import { useEffect, useMemo, useState } from "react";
import type { Garden } from "../types/garden";
import { formatCurrency } from "../utils/formatting";
import {
  applyGardenFilters,
  calculateRanges,
  type FilterValues,
  hasActiveFilters as filtersDifferFrom,
  loadFiltersFromStorage,
  saveFiltersToStorage,
} from "../utils/gardenFilters";

interface GardenFiltersProps {
  gardens: Garden[];
  onFilterChange: (filteredGardens: Garden[]) => void;
  onFilterActiveChange?: (isActive: boolean) => void;
}

interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  format: (value: number) => string;
}

/** Bereichs-Slider aus zwei übereinanderliegenden nativen Reglern (Styling in index.css) */
function RangeSlider({
  label,
  min,
  max,
  step,
  value: [low, high],
  onChange,
  format,
}: RangeSliderProps) {
  const percent = (v: number) => (max > min ? ((v - min) / (max - min)) * 100 : 0);
  return (
    <div className="space-y-2">
      <span className="block text-sm font-semibold text-scholle-text-light mb-2">{label}</span>
      <div
        className="range-slider"
        style={
          { "--low": `${percent(low)}%`, "--high": `${percent(high)}%` } as React.CSSProperties
        }
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={low}
          aria-label={`${label} von`}
          aria-valuetext={format(low)}
          onChange={(e) => onChange([Math.min(Number(e.target.value), high), high])}
          // Liegen beide Griffe am rechten Ende, muss der untere oben liegen, sonst klemmt er
          style={{ zIndex: low > min + (max - min) / 2 ? 2 : undefined }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={high}
          aria-label={`${label} bis`}
          aria-valuetext={format(high)}
          onChange={(e) => onChange([low, Math.max(Number(e.target.value), low)])}
        />
      </div>
      <div className="flex items-center justify-between text-sm text-scholle-text">
        <span>{format(low)}</span>
        <span>{format(high)}</span>
      </div>
    </div>
  );
}

export default function GardenFilters({
  gardens,
  onFilterChange,
  onFilterActiveChange,
}: GardenFiltersProps) {
  const ranges = useMemo(() => calculateRanges(gardens), [gardens]);
  const [filters, setFilters] = useState<FilterValues>(() => loadFiltersFromStorage(ranges));

  // Speichere Filter-Werte in localStorage wenn sie sich ändern
  useEffect(() => {
    saveFiltersToStorage(filters, ranges);
  }, [filters, ranges]);

  const [isExpanded, setIsExpanded] = useState(false);

  const filteredGardens = useMemo(() => applyGardenFilters(gardens, filters), [gardens, filters]);

  useEffect(() => {
    onFilterChange(filteredGardens);
  }, [filteredGardens]);

  const resetFilters = () => {
    setFilters({ ...ranges, onlyAvailableNow: false });
  };

  const hasActiveFilters = filtersDifferFrom(filters, ranges);

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
          className={`px-4 pb-4 space-y-6 pt-4 mx-2 mb-2 rounded-lg bg-white border-2 border-scholle-green/20 shadow-xs transition-opacity duration-300 ${
            isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <RangeSlider
            label="Preis (Wertermittlung)"
            min={ranges.minPrice}
            max={ranges.maxPrice}
            step={50}
            value={[filters.minPrice, filters.maxPrice]}
            onChange={([minPrice, maxPrice]) => setFilters({ ...filters, minPrice, maxPrice })}
            format={(value) => formatCurrency(value)}
          />

          <RangeSlider
            label="Größe"
            min={ranges.minSize}
            max={ranges.maxSize}
            step={10}
            value={[filters.minSize, filters.maxSize]}
            onChange={([minSize, maxSize]) => setFilters({ ...filters, minSize, maxSize })}
            format={(value) => `${value} m²`}
          />

          <label className="flex items-center gap-2 text-sm font-medium text-scholle-text cursor-pointer">
            <input
              type="checkbox"
              checked={filters.onlyAvailableNow}
              onChange={(e) => setFilters({ ...filters, onlyAvailableNow: e.target.checked })}
              className="w-4 h-4 accent-scholle-green cursor-pointer"
            />
            Nur frei ab sofort
          </label>

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
