import type { Garden } from '../types/garden';
import GardenChecklist from './GardenChecklist';
import { formatDate, formatCurrency } from '../utils/formatting';

interface GardenDetailsProps {
  garden: Garden | null;
  osmGeometry?: Array<{ lat: number; lon: number }>;
  gardenNumber?: string; // Für den Fall, dass Garten existiert aber keine Details vorliegen
  osmParcel?: string | null; // Parzelle aus OSM
  osmSize?: number; // Größe aus OSM
}

export default function GardenDetails({ garden, gardenNumber, osmParcel, osmSize }: GardenDetailsProps) {

  // Prüfe ob Garten existiert aber keine Details vorliegen (keine Datenbankdaten)
  // Ein Garten hat keine Details, wenn gardenNumber existiert, aber garden null ist
  // ODER wenn garden existiert, aber keine Datenbankfelder gesetzt sind (availableFrom, valuation, etc.)
  const hasNoDetails = gardenNumber && (!garden || (!garden.availableFrom && garden.valuation === 0 && garden.valueReduction === 0));

  if (!garden && !hasNoDetails) {
    return (
      <div className="w-full p-6 bg-scholle-bg-light rounded-lg border border-scholle-border">
        <p className="text-scholle-text-light text-center">
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
      <div className="w-full bg-scholle-bg-container rounded-lg border border-scholle-border shadow-sm flex flex-col lg:h-full lg:min-h-0 overflow-hidden">
        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overflow-x-visible">
          <h2 className="text-2xl font-bold mb-4 text-scholle-text border-b border-scholle-border pb-2">Gartendetails</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-scholle-text-light mb-1 uppercase tracking-wide">
                  Garten-Nr.
                </label>
                <p className="text-lg font-semibold text-scholle-text">{displayNumber}</p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-scholle-text-light mb-1 uppercase tracking-wide">
                  Parzelle
                </label>
                <p className="text-lg text-scholle-text">{displayParcel}</p>
              </div>
            </div>

            {displaySize !== null && (
              <div>
                <label className="block text-sm font-semibold text-scholle-text-light mb-1 uppercase tracking-wide">
                  Größe
                </label>
                <div className="space-y-1">
                  {garden?.osmSize !== undefined && garden?.osmSize !== null ? (
                    <>
                      {garden.size > 0 && (
                        <p className="text-lg text-scholle-text">
                          {garden.size} m² <span className="text-sm text-scholle-text-light">(Datenbank)</span>
                        </p>
                      )}
                      <p className="text-sm text-scholle-text-light">
                        {garden.osmSize} m² <span className="text-xs">(aus der Karte berechnet)</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-lg text-scholle-text">
                      {displaySize} m² {osmSize ? <span className="text-sm text-scholle-text-light">(aus der Karte berechnet)</span> : ''}
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
                    Der Garten ist derzeit bereits verpachtet und steht nicht zur Verfügung.
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19v-4" />
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
    <div className="w-full bg-scholle-bg-container rounded-lg border border-scholle-border shadow-sm flex flex-col lg:h-full lg:min-h-0 overflow-hidden">
      <div className="p-6 overflow-y-auto flex-1 min-h-0 overflow-x-visible">
          <h2 className="text-2xl font-bold mb-4 text-scholle-text border-b border-scholle-border pb-2">Gartendetails</h2>
          
          <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-scholle-text-light mb-1 uppercase tracking-wide">
              Garten-Nr.
            </label>
            <p className="text-lg font-semibold text-scholle-text">{garden.number}</p>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-scholle-text-light mb-1 uppercase tracking-wide">
              Parzelle
            </label>
            <p className="text-lg text-scholle-text">{garden.parcel || '-'}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-scholle-text-light mb-1 uppercase tracking-wide">
            Größe
          </label>
          <div className="space-y-1">
            <p className="text-lg text-scholle-text">
              {garden.size} m² <span className="text-sm text-scholle-text-light">(Datenbank)</span>
            </p>
            {garden.osmSize !== undefined && garden.osmSize !== null && (
              <p className="text-sm text-scholle-text-light">
                {garden.osmSize} m² <span className="text-xs">(aus der Karte berechnet)</span>
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-scholle-text-light mb-1 uppercase tracking-wide">
            Frei ab
          </label>
          <p className="text-lg text-scholle-text">{formatDate(garden.availableFrom)}</p>
        </div>

        {/* Ausstattung nur anzeigen, wenn mindestens eine bekannte Ausstattung vorhanden ist */}
        {(garden.hasElectricity === true || (garden.waterConnection !== undefined && garden.waterConnection !== 'kein')) && (
          <div className="pt-4 border-t border-scholle-border">
            <label className="block text-sm font-semibold text-scholle-text-light mb-3 uppercase tracking-wide">
              Ausstattung
            </label>
            <div className="space-y-3">
              {/* Stromanschluss - nur anzeigen wenn bekannt und vorhanden */}
              {garden.hasElectricity === true && (
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {getElectricityIcon(true)}
                  </div>
                  <span className="text-sm text-scholle-text">
                    Stromanschluss vorhanden
                  </span>
                </div>
              )}

              {/* Wasseranschluss - nur anzeigen wenn bekannt und vorhanden */}
              {garden.waterConnection !== undefined && garden.waterConnection !== 'kein' && (
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {getWaterIcon(garden.waterConnection)}
                  </div>
                  <span className="text-sm text-scholle-text">
                    {getWaterConnectionLabel(garden.waterConnection)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {(garden.valuation > 0 || garden.valueReduction > 0) && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-scholle-border">
            <div>
              <label className="block text-sm font-semibold text-scholle-text-light mb-1 uppercase tracking-wide">
                Wertermittlung
              </label>
              <p className="text-lg font-semibold text-scholle-text">
                {formatCurrency(garden.valuation)}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-scholle-text-light mb-1 uppercase tracking-wide">
                Wertminderung
              </label>
              <p className="text-lg font-semibold text-red-600">
                {formatCurrency(garden.valueReduction)}
              </p>
            </div>
          </div>
        )}

        {/* Checkliste für freie Gärten */}
        <GardenChecklist garden={garden} />
      </div>
      </div>
    </div>
  );
}

