import { useState } from 'react';
import type { Garden } from '../types/garden';

interface GardenDetailsProps {
  garden: Garden | null;
  osmGeometry?: Array<{ lat: number; lon: number }>;
  gardenNumber?: string; // Für den Fall, dass Garten existiert aber keine Details vorliegen
  osmParcel?: string | null; // Parzelle aus OSM
  osmSize?: number; // Größe aus OSM
}

export default function GardenDetails({ garden, gardenNumber, osmParcel, osmSize }: GardenDetailsProps) {
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);

  // Prüfe ob Garten existiert aber keine Details vorliegen (keine Datenbankdaten)
  // Ein Garten hat keine Details, wenn gardenNumber existiert, aber garden null ist
  // ODER wenn garden existiert, aber keine Datenbankfelder gesetzt sind (availableFrom, valuation, etc.)
  const hasNoDetails = gardenNumber && (!garden || (!garden.availableFrom && garden.valuation === 0 && garden.valueReduction === 0));

  if (!garden && !hasNoDetails) {
    return (
      <div className="w-full p-6 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500 text-center">
          Kein Garten ausgewählt. Geben Sie eine Garten-Nummer ein und suchen Sie.
        </p>
      </div>
    );
  }

  // Zeige Hinweis wenn Garten existiert aber keine Details vorliegen
  if (hasNoDetails) {
    // Verwende OSM-Daten falls vorhanden, sonst nur gardenNumber
    const displayNumber = garden?.number || gardenNumber || '-';
    const displayParcel = garden?.parcel || osmParcel || '-';
    const displaySize = garden?.osmSize || osmSize || garden?.size || null;

    return (
      <div className="w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full overflow-visible">
        <div className="p-6 space-y-4 overflow-y-auto flex-1 overflow-x-visible">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Gartendetails</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Garten-Nr.
                </label>
                <p className="text-lg font-semibold text-gray-900">{displayNumber}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Parzelle
                </label>
                <p className="text-lg text-gray-900">{displayParcel}</p>
              </div>
            </div>

            {displaySize !== null && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Größe
                </label>
                <div className="space-y-1">
                  {garden?.osmSize !== undefined && garden?.osmSize !== null ? (
                    <>
                      {garden.size > 0 && (
                        <p className="text-lg text-gray-900">
                          {garden.size} m² <span className="text-sm text-gray-500">(Datenbank)</span>
                        </p>
                      )}
                      <p className="text-sm text-gray-500">
                        {garden.osmSize} m² <span className="text-xs">(OSM berechnet)</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-lg text-gray-900">
                      {displaySize} m² {osmSize ? <span className="text-sm text-gray-500">(OSM berechnet)</span> : ''}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-yellow-700 font-medium">
                    Der Garten ist derzeit bereits verpachtet und nicht frei zur Verpachtung.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ab hier ist garden garantiert nicht null
  if (!garden) {
    return null;
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getWaterConnectionLabel = (type: string) => {
    switch (type) {
      case 'brunnen':
        return 'Brunnen';
      case 'wasserleitung':
        return 'Wasserleitung (Stadtwerke)';
      case 'brunnen-aussen':
        return 'Brunnen außerhalb des Gartens';
      case 'kein':
        return 'Kein Wasseranschluss';
      default:
        return type;
    }
  };

  const getWaterIcon = (type: string) => {
    switch (type) {
      case 'brunnen':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
      case 'wasserleitung':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.548M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        );
      case 'brunnen-aussen':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
      case 'kein':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
    }
  };

  const getElectricityIcon = (hasElectricity: boolean) => {
    if (hasElectricity) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  };

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full overflow-visible">
      <div className="p-6 space-y-4 overflow-y-auto flex-1 overflow-x-visible">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Gartendetails</h2>
          
          <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Garten-Nr.
            </label>
            <p className="text-lg font-semibold text-gray-900">{garden.number}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Parzelle
            </label>
            <p className="text-lg text-gray-900">{garden.parcel || '-'}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Größe
          </label>
          <div className="space-y-1">
            <p className="text-lg text-gray-900">
              {garden.size} m² <span className="text-sm text-gray-500">(Datenbank)</span>
            </p>
            {garden.osmSize !== undefined && garden.osmSize !== null && (
              <p className="text-sm text-gray-500">
                {garden.osmSize} m² <span className="text-xs">(OSM berechnet)</span>
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Frei ab
          </label>
          <p className="text-lg text-gray-900">{formatDate(garden.availableFrom)}</p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Ausstattung
          </label>
          <div className="flex gap-4">
            {/* Stromanschluss */}
            <div className="relative z-[10000]">
              <button
                className={`w-10 h-10 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer rounded-lg text-gray-700 hover:bg-gray-100 ${
                  !garden.hasElectricity ? 'opacity-40' : ''
                }`}
                onMouseEnter={() => setHoveredIcon('electricity')}
                onMouseLeave={() => setHoveredIcon(null)}
                onClick={() => setHoveredIcon(hoveredIcon === 'electricity' ? null : 'electricity')}
                aria-label="Stromanschluss"
              >
                {getElectricityIcon(garden.hasElectricity)}
              </button>
              {hoveredIcon === 'electricity' && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap pointer-events-none z-[10001]">
                  {garden.hasElectricity ? 'Stromanschluss vorhanden' : 'Kein Stromanschluss'}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>

            {/* Wasseranschluss */}
            <div className="relative z-[10000] overflow-visible">
              <button
                className={`w-10 h-10 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer rounded-lg text-gray-700 hover:bg-gray-100 ${
                  garden.waterConnection === 'kein' ? 'opacity-40' : ''
                }`}
                onMouseEnter={() => setHoveredIcon('water')}
                onMouseLeave={() => setHoveredIcon(null)}
                onClick={() => setHoveredIcon(hoveredIcon === 'water' ? null : 'water')}
                aria-label="Wasseranschluss"
              >
                {getWaterIcon(garden.waterConnection)}
              </button>
              {hoveredIcon === 'water' && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap pointer-events-none z-[10001]">
                  {getWaterConnectionLabel(garden.waterConnection)}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Wertermittlung
            </label>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(garden.valuation)}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Wertminderung
            </label>
            <p className="text-lg font-semibold text-red-600">
              {formatCurrency(garden.valueReduction)}
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

