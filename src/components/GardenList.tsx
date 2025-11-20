import { useState, useMemo } from 'react';
import type { Garden } from '../types/garden';

interface GardenListProps {
  gardens: Garden[];
  onGardenClick: (gardenNumber: string) => void;
  hoveredGardenNumber?: string | null;
  onGardenHover?: (gardenNumber: string | null) => void;
}

type SortOption = 'number' | 'availableFrom';

// Hilfsfunktion zum Parsen des "Frei ab" Datums
const parseAvailableDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const lowerCaseDate = dateString.toLowerCase();
  if (lowerCaseDate === 'sofort' || lowerCaseDate === 'ab sofort') {
    return null; // "Sofort" wird als frühestes Datum behandelt
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
};

export default function GardenList({ gardens, onGardenClick, hoveredGardenNumber, onGardenHover }: GardenListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('number');

  // Filtere freie Gärten (availableFrom gesetzt und nicht leer)
  const availableGardens = gardens.filter(garden => 
    garden.availableFrom && garden.availableFrom.trim() !== ''
  );

  // Sortiere nach ausgewählter Option
  const sortedGardens = useMemo(() => {
    return [...availableGardens].sort((a, b) => {
      if (sortBy === 'number') {
        const numA = parseInt(a.number, 10);
        const numB = parseInt(b.number, 10);
        return numA - numB;
      } else {
        // Sortiere nach "Frei ab" Datum
        const dateA = parseAvailableDate(a.availableFrom);
        const dateB = parseAvailableDate(b.availableFrom);
        
        // "Sofort" kommt zuerst
        if (dateA === null && dateB === null) return 0;
        if (dateA === null) return -1;
        if (dateB === null) return 1;
        
        return dateA.getTime() - dateB.getTime();
      }
    });
  }, [availableGardens, sortBy]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const lowerCaseDate = dateString.toLowerCase();
    if (lowerCaseDate === 'sofort' || lowerCaseDate === 'ab sofort') {
      return 'Sofort';
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString('de-DE');
    } catch {
      return dateString;
    }
  };

  if (sortedGardens.length === 0) {
    return (
      <div className="bg-scholle-bg-container rounded-lg border border-scholle-border shadow-sm p-6 flex flex-col h-full min-h-0">
        <h2 className="text-xl font-bold text-scholle-text mb-4">Freie Gärten</h2>
        <p className="text-scholle-text-light">Aktuell sind keine freien Gärten verfügbar.</p>
      </div>
    );
  }

  return (
    <div className="bg-scholle-bg-container rounded-lg border border-scholle-border shadow-sm flex flex-col h-full min-h-0">
      <div className="bg-scholle-green text-white px-4 py-3 rounded-t-lg flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Freie Gärten</h2>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/90">
            {sortedGardens.length} {sortedGardens.length === 1 ? 'Garten verfügbar' : 'Gärten verfügbar'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('number')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                sortBy === 'number'
                  ? 'bg-white text-scholle-green'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title="Nach Gartennummer sortieren"
            >
              Nr.
            </button>
            <button
              onClick={() => setSortBy('availableFrom')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                sortBy === 'availableFrom'
                  ? 'bg-white text-scholle-green'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title="Nach Verfügbarkeitsdatum sortieren"
            >
              Frei ab
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="divide-y divide-scholle-border">
          {sortedGardens.map((garden) => {
            const isHovered = hoveredGardenNumber === garden.number;
            return (
              <button
                key={garden.id}
                onClick={() => onGardenClick(garden.number)}
                onMouseEnter={() => onGardenHover?.(garden.number)}
                onMouseLeave={() => onGardenHover?.(null)}
                className={`w-full text-left p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-scholle-green focus:ring-inset ${
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
                    <div className="flex items-center gap-4">
                      <span>{garden.size} m²</span>
                      <span className="text-scholle-green font-medium">
                        Frei ab {formatDate(garden.availableFrom)}
                      </span>
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
      </div>
    </div>
  );
}

