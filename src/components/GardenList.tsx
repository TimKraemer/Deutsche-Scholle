import { useState, useMemo, useEffect } from 'react';
import type { Garden } from '../types/garden';
import { sortGardens, filterAvailableGardens, type SortOption, type SortDirection, type SortConfig } from '../utils/gardenSort';
import GardenFilters from './GardenFilters';
import { LAST_DB_UPDATE } from '../data/mockGardens';
import { formatDate, formatCurrency, formatLastUpdate } from '../utils/formatting';

interface GardenListProps {
  gardens: Garden[];
  onGardenClick: (gardenNumber: string) => void;
  hoveredGardenNumber?: string | null;
  onGardenHover?: (gardenNumber: string | null) => void;
  onFilteredGardensChange?: (filteredGardens: Garden[]) => void;
}

export default function GardenList({ gardens, onGardenClick, hoveredGardenNumber, onGardenHover, onFilteredGardensChange }: GardenListProps) {
  // Lade Sortierung aus localStorage oder verwende Standard
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const savedField = localStorage.getItem('gardenSortBy');
    const savedDirection = localStorage.getItem('gardenSortDirection') as SortDirection;
    const validOptions: SortOption[] = ['number', 'availableFrom', 'size', 'valuation'];
    const field = validOptions.includes(savedField as SortOption) ? (savedField as SortOption) : 'number';
    const direction = (savedDirection === 'asc' || savedDirection === 'desc') ? savedDirection : 'asc';
    return { field, direction };
  });

  // Speichere Sortierung in localStorage wenn sie geändert wird
  const handleSortChange = (newField: SortOption) => {
    setSortConfig(prev => {
      // Wenn dasselbe Feld angeklickt wird, wechsle die Richtung
      const newDirection = prev.field === newField && prev.direction === 'asc' ? 'desc' : 'asc';
      const newConfig = { field: newField, direction: newDirection };
      localStorage.setItem('gardenSortBy', newField);
      localStorage.setItem('gardenSortDirection', newDirection);
      return newConfig;
    });
  };

  // Filtere freie Gärten (availableFrom gesetzt und nicht leer)
  const availableGardens = useMemo(() => filterAvailableGardens(gardens), [gardens]);

  // Gefilterte Gärten (nach Filter-Kriterien)
  const [filteredGardens, setFilteredGardens] = useState<Garden[]>(availableGardens);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Aktualisiere gefilterte Gärten wenn sich verfügbare Gärten ändern
  useEffect(() => {
    setFilteredGardens(availableGardens);
    setHasActiveFilters(false);
  }, [availableGardens]);

  // Informiere Parent über gefilterte Gärten
  useEffect(() => {
    onFilteredGardensChange?.(filteredGardens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredGardens]);

  const handleFilterChange = (filtered: Garden[]) => {
    setFilteredGardens(filtered);
  };

  const handleFilterActiveChange = (isActive: boolean) => {
    setHasActiveFilters(isActive);
  };

  // Sortiere nach ausgewählter Option und Richtung
  const sortedGardens = useMemo(() => {
    return sortGardens(filteredGardens, sortConfig.field, sortConfig.direction);
  }, [filteredGardens, sortConfig]);


  // Prüfe ob keine Ergebnisse wegen Filterung vorhanden sind
  const hasNoResults = sortedGardens.length === 0;
  const isFiltered = hasActiveFilters && availableGardens.length > 0;


  return (
    <div className="bg-scholle-bg-container rounded-lg border border-scholle-border shadow-sm flex flex-col lg:h-full lg:min-h-0">
      <div className="bg-scholle-green text-white px-4 py-3 rounded-t-lg flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Freie Gärten</h2>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-col">
            <p className="text-sm text-white/90">
              {sortedGardens.length} {sortedGardens.length === 1 ? 'Garten verfügbar' : 'Gärten verfügbar'}
            </p>
            <p className="text-xs text-white/70 mt-0.5">
              Stand: {formatLastUpdate(LAST_DB_UPDATE)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleSortChange('number')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                sortConfig.field === 'number'
                  ? 'bg-white text-scholle-green'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title={`Nach Gartennummer sortieren (${sortConfig.field === 'number' ? sortConfig.direction === 'asc' ? 'aufsteigend' : 'absteigend' : 'aufsteigend'})`}
            >
              <span>Nr.</span>
              {sortConfig.field === 'number' && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {sortConfig.direction === 'asc' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  )}
                </svg>
              )}
            </button>
            <button
              onClick={() => handleSortChange('availableFrom')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                sortConfig.field === 'availableFrom'
                  ? 'bg-white text-scholle-green'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title={`Nach Verfügbarkeitsdatum sortieren (${sortConfig.field === 'availableFrom' ? sortConfig.direction === 'asc' ? 'aufsteigend' : 'absteigend' : 'aufsteigend'})`}
            >
              <span>Frei ab</span>
              {sortConfig.field === 'availableFrom' && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {sortConfig.direction === 'asc' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  )}
                </svg>
              )}
            </button>
            <button
              onClick={() => handleSortChange('size')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                sortConfig.field === 'size'
                  ? 'bg-white text-scholle-green'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title={`Nach Größe sortieren (${sortConfig.field === 'size' ? sortConfig.direction === 'asc' ? 'aufsteigend' : 'absteigend' : 'aufsteigend'})`}
            >
              <span>Größe</span>
              {sortConfig.field === 'size' && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {sortConfig.direction === 'asc' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  )}
                </svg>
              )}
            </button>
            <button
              onClick={() => handleSortChange('valuation')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                sortConfig.field === 'valuation'
                  ? 'bg-white text-scholle-green'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title={`Nach Preis sortieren (${sortConfig.field === 'valuation' ? sortConfig.direction === 'asc' ? 'aufsteigend' : 'absteigend' : 'aufsteigend'})`}
            >
              <span>Preis</span>
              {sortConfig.field === 'valuation' && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {sortConfig.direction === 'asc' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  )}
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Filter */}
      <GardenFilters gardens={availableGardens} onFilterChange={handleFilterChange} onFilterActiveChange={handleFilterActiveChange} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {hasNoResults ? (
          <div className="p-6 text-center">
            {isFiltered ? (
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
                className={`w-full text-left p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-scholle-green focus:ring-inset relative z-10 ${
                  isHovered 
                    ? 'bg-scholle-green/10 border-l-4 border-l-scholle-green' 
                    : 'hover:bg-scholle-bg-light'
                }`}
              >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-semibold text-scholle-text">
                      Garten {garden.number}
                    </span>
                    {garden.hasElectricity === true && (
                      <svg className="w-4 h-4 text-scholle-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    {garden.waterConnection && garden.waterConnection !== 'kein' && (
                      <svg className="w-4 h-4 text-scholle-text-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.548M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    )}
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
                        Wert: {formatCurrency(garden.valuation)}
                      </span>
                      {garden.valueReduction > 0 && (
                        <span className="text-red-600 font-medium">
                          -{formatCurrency(garden.valueReduction)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-scholle-text-light flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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

