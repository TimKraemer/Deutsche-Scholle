import type { Garden } from "../types/garden";
import { formatDate, formatGardenValue, hasGardenValue } from "../utils/formatting";
import GardenChecklist from "./GardenChecklist";

interface GardenDetailsProps {
  garden: Garden | null;
  gardenNumber?: string; // Für den Fall, dass Garten existiert aber keine Details vorliegen
  osmParcel?: string | null; // Parzelle aus OSM
  osmSize?: number; // Größe aus OSM
  listUnavailable?: boolean; // Vereinsliste nicht geladen: nicht als "verpachtet" melden
}

export default function GardenDetails({
  garden,
  gardenNumber,
  osmParcel,
  osmSize,
  listUnavailable = false,
}: GardenDetailsProps) {
  // Prüfe ob Garten existiert aber keine Details vorliegen (keine Datenbankdaten)
  // Ein Garten hat keine Details, wenn gardenNumber existiert, aber garden null ist
  // ODER wenn garden existiert, aber keine Datenbankfelder gesetzt sind (availableFrom, valuation, etc.)
  const hasNoDetails =
    gardenNumber &&
    (!garden ||
      (!garden.availableFrom &&
        !hasGardenValue(garden.valuation) &&
        !hasGardenValue(garden.valueReduction)));

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
    const displayNumber = garden?.number || gardenNumber || "-";
    const displayParcel = garden?.parcel || osmParcel || "-";
    const displaySize = garden?.osmSize || osmSize || garden?.size || null;

    return (
      <div className="w-full bg-scholle-bg-container rounded-lg border border-scholle-border shadow-xs flex flex-col lg:h-full lg:min-h-0 overflow-hidden">
        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overflow-x-visible">
          <h2 className="text-2xl font-bold mb-4 text-scholle-text border-b border-scholle-border pb-2">
            Gartendetails
          </h2>

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
                          {garden.size} m²{" "}
                          <span className="text-sm text-scholle-text-light">(Datenbank)</span>
                        </p>
                      )}
                      <p className="text-sm text-scholle-text-light">
                        {garden.osmSize} m²{" "}
                        <span className="text-xs">(aus der Karte berechnet)</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-lg text-scholle-text">
                      {displaySize} m²{" "}
                      {osmSize ? (
                        <span className="text-sm text-scholle-text-light">
                          (aus der Karte berechnet)
                        </span>
                      ) : (
                        ""
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-4">
              <div className="flex items-start">
                <div className="shrink-0">
                  <svg
                    className="h-6 w-6 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-yellow-700 font-medium">
                    {listUnavailable
                      ? "Die Liste der freien Gärten ist gerade nicht erreichbar. Ob dieser Garten frei ist, lässt sich nicht sagen."
                      : "Der Garten ist derzeit bereits verpachtet und steht nicht zur Verfügung."}
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

  return (
    <div className="w-full bg-scholle-bg-container rounded-lg border border-scholle-border shadow-xs flex flex-col lg:h-full lg:min-h-0 overflow-hidden">
      <div className="p-6 overflow-y-auto flex-1 min-h-0 overflow-x-visible">
        <h2 className="text-2xl font-bold mb-4 text-scholle-text border-b border-scholle-border pb-2">
          Gartendetails
        </h2>

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
              <p className="text-lg text-scholle-text">{garden.parcel || "-"}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-scholle-text-light mb-1 uppercase tracking-wide">
              Größe
            </label>
            <div className="space-y-1">
              <p className="text-lg text-scholle-text">
                {garden.size} m²{" "}
                <span className="text-sm text-scholle-text-light">(Datenbank)</span>
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

          {(hasGardenValue(garden.valuation) || hasGardenValue(garden.valueReduction)) && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-scholle-border">
              <div>
                <label className="block text-sm font-semibold text-scholle-text-light mb-1 uppercase tracking-wide">
                  Wertermittlung
                </label>
                <p className="text-lg font-semibold text-scholle-text">
                  {formatGardenValue(garden.valuation)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-scholle-text-light mb-1 uppercase tracking-wide">
                  Wertminderung
                </label>
                <p className="text-lg font-semibold text-red-600">
                  {formatGardenValue(garden.valueReduction)}
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
