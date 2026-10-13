import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CookieConsentRef } from "../components/CookieConsent";
import CookieConsent from "../components/CookieConsent";
import Footer from "../components/Footer";
import GardenDetails from "../components/GardenDetails";
import { useCookiePreferences } from "../hooks/useCookiePreferences";
import { useFreeGardens } from "../hooks/useFreeGardens";
import { useGardenData } from "../hooks/useGardenData";
import type { Garden } from "../types/garden";
import { findGardenByNumber } from "../utils/freeGardens";
import { latestKnownGardens, loadFreeGardensHistory } from "../utils/freeGardensHistory";
import {
  applyGardenFilters,
  calculateRanges,
  hasActiveFilters,
  loadFiltersFromStorage,
} from "../utils/gardenFilters";
import { filterAvailableGardens, loadSortConfig, sortGardens } from "../utils/gardenSort";
import { findOsmGarden, osmWayToGarden } from "../utils/osm";

// Karte (Leaflet) lazy laden: schwerste Abhängigkeit, getrennter Chunk
const GardenMap = lazy(() => import("../components/GardenMap"));

export default function GardenPage() {
  const { gardenNumber } = useParams<{ gardenNumber: string }>();
  const navigate = useNavigate();
  const { cookiePreferences, handleConsentChange } = useCookiePreferences();
  const {
    gardenData,
    allGardens,
    isLoading: osmLoading,
    hasError: osmError,
  } = useGardenData(cookiePreferences.openStreetMap);
  const {
    gardens: freeGardens,
    isLoading: freeGardensLoading,
    hasError: freeGardensError,
  } = useFreeGardens();

  // Daten aus der Vereinsliste (/freie-gaerten.json), OSM-Daten (Umriss, Parzelle) kommen aus
  // dem Snapshot dazu. Alles wird synchron abgeleitet, es gibt keine eigene Abfrage pro Garten.
  const listGarden = useMemo(
    () => (gardenNumber ? (findGardenByNumber(freeGardens, gardenNumber) ?? null) : null),
    [freeGardens, gardenNumber]
  );

  // Nicht (mehr) freier Garten: Parzelle und Größe aus dem Verlauf der Vereinsliste, falls er
  // früher einmal frei war. undefined = wird noch gesucht, null = nie auf der Liste.
  const [pastGarden, setPastGarden] = useState<Garden | null | undefined>(undefined);
  useEffect(() => {
    setPastGarden(undefined);
    if (listGarden || freeGardensLoading || !gardenNumber) return;
    let cancelled = false;
    loadFreeGardensHistory()
      .then((snapshots) => {
        const known = latestKnownGardens(snapshots).find((k) => k.garden.number === gardenNumber);
        // Wert und "frei ab" gelten nicht mehr, der Garten ist vergeben
        if (!cancelled) {
          setPastGarden(
            known ? { ...known.garden, availableFrom: "", valuation: 0, valueReduction: 0 } : null
          );
        }
      })
      .catch((error) => {
        console.error("Error loading free gardens history:", error);
        if (!cancelled) setPastGarden(null);
      });
    return () => {
      cancelled = true;
    };
  }, [gardenNumber, listGarden, freeGardensLoading]);
  const clubGarden = listGarden ?? pastGarden ?? null;
  const osmWay = useMemo(
    () => (gardenData && gardenNumber ? findOsmGarden(gardenData, gardenNumber) : null),
    [gardenData, gardenNumber]
  );
  const osmParcel = (osmWay && gardenData?.parcels[osmWay.id]) || null;
  const osmGarden = useMemo(
    () => (osmWay ? osmWayToGarden(osmWay, clubGarden ?? undefined, osmParcel) : null),
    [osmWay, clubGarden, osmParcel]
  );
  const selectedGarden: Garden | null = osmGarden ?? clubGarden;
  const hasOsmData = osmGarden !== null;
  const osmGeometry = hasOsmData ? osmWay?.geometry : undefined;
  const osmSize = osmGarden?.osmSize;

  // Vollbild-Spinner, solange die Vereinsliste lädt oder der Garten nicht darin steht und wir auf OSM warten
  const isLoading = freeGardensLoading || (!listGarden && osmLoading);

  let error: string | null = null;
  if (!listGarden) {
    if (freeGardensError) {
      error =
        "Die Liste der freien Gärten konnte nicht geladen werden. Ob dieser Garten frei ist, lässt sich gerade nicht sagen.";
    } else if (!cookiePreferences.openStreetMap && pastGarden === null) {
      error = `Garten mit Nummer "${gardenNumber}" nicht gefunden. Bitte aktivieren Sie OpenStreetMap in den Cookie-Einstellungen, um auch Gärten zu finden, die nur in OSM vorhanden sind.`;
    } else if (osmError) {
      error = "Fehler beim Laden der Kartendaten. Bitte versuchen Sie es erneut.";
    } else if (gardenData && !osmWay && pastGarden === null) {
      error = `Garten mit Nummer "${gardenNumber}" nicht gefunden.`;
    } else if (osmWay && !osmGarden) {
      error = "Garten gefunden, aber Geometrie konnte nicht verarbeitet werden.";
    }
  }
  // Sortierung wie auf der Startseite, damit "Vorheriger/Nächster" der Liste folgt
  const [sortConfig] = useState(loadSortConfig);
  const cookieConsentRef = useRef<CookieConsentRef>(null);

  // Filter und Sortierung wie auf der Startseite: beim Durchblättern erscheinen nur die
  // Gärten, die den aktiven Filtern entsprechen
  const { availableGardens, filtersActive } = useMemo(() => {
    const available = filterAvailableGardens(freeGardens);
    const ranges = calculateRanges(available);
    const filters = loadFiltersFromStorage(ranges);
    return {
      availableGardens: sortGardens(
        applyGardenFilters(available, filters),
        sortConfig.field,
        sortConfig.direction
      ),
      filtersActive: hasActiveFilters(filters, ranges),
    };
  }, [freeGardens, sortConfig]);

  // Finde aktuellen Index in der gefilterten und sortierten Liste
  const currentIndex = useMemo(() => {
    if (!gardenNumber || !selectedGarden) return -1;
    return availableGardens.findIndex((g) => g.number === gardenNumber);
  }, [gardenNumber, selectedGarden, availableGardens]);

  // Berechne vorherigen und nächsten Garten aus der gefilterten Liste
  // WICHTIG: Nur Gärten die den aktiven Filtern entsprechen werden beim Durchblättern angezeigt
  const previousGarden = currentIndex > 0 ? availableGardens[currentIndex - 1] : null;
  const nextGarden =
    currentIndex >= 0 && currentIndex < availableGardens.length - 1
      ? availableGardens[currentIndex + 1]
      : null;

  const handleGardenClick = (number: string) => {
    navigate(`/${number}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-scholle-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-scholle-green mx-auto mb-4"></div>
          <p className="text-scholle-text-light">Lade Garten {gardenNumber}...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <CookieConsent
        ref={cookieConsentRef}
        onConsentChange={handleConsentChange}
        openWhenUndecided
      />
      <div className="min-h-screen bg-scholle-bg flex flex-col lg:h-screen lg:overflow-hidden">
        <div className="container mx-auto px-4 py-4 shrink-0">
          <header className="mb-4">
            <div className="flex items-center gap-4 mb-1">
              <button
                onClick={() => navigate("/")}
                className="text-sm text-scholle-blue hover:text-scholle-blue-dark transition-colors font-medium"
              >
                ← Zurück zur Übersicht
              </button>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-scholle-text mb-1">
              Garten {gardenNumber}
            </h1>
            <p className="text-sm lg:text-base text-scholle-text-light">
              Kleingartenverein Deutsche Scholle
            </p>
          </header>

          {error && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col px-4 pb-4 lg:min-h-0 lg:overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
            <div className="lg:col-span-2 flex flex-col lg:min-h-0 lg:overflow-hidden">
              <Suspense
                fallback={
                  <div className="flex-1 min-h-[350px] bg-scholle-bg-light rounded-lg border border-scholle-border" />
                }
              >
                {hasOsmData && osmGeometry ? (
                  <GardenMap
                    selectedGarden={selectedGarden}
                    osmGeometry={osmGeometry}
                    allGardens={allGardens}
                    availableGardens={availableGardens}
                    onGardenClick={handleGardenClick}
                    defaultMapType="3d"
                    cookiePreferences={cookiePreferences}
                    onOpenCookieConsent={() => cookieConsentRef.current?.open()}
                    disable3D={selectedGarden === null}
                  />
                ) : osmLoading ? (
                  <div className="flex-1 min-h-[350px] bg-scholle-bg-light rounded-lg border border-scholle-border flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-scholle-green mx-auto mb-3" />
                      <p className="text-scholle-text-light text-sm">Karte wird geladen…</p>
                    </div>
                  </div>
                ) : selectedGarden && !hasOsmData && cookiePreferences.openStreetMap ? (
                  <div className="flex-1 min-h-[350px] bg-scholle-bg-light rounded-lg border border-scholle-border flex items-center justify-center">
                    <div className="bg-scholle-bg-container rounded-lg border border-scholle-border shadow-xs p-6 max-w-2xl w-full">
                      <div className="flex items-start gap-4">
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
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-scholle-text mb-2">
                            Kartenansicht nicht verfügbar
                          </h3>
                          <p className="text-base text-scholle-text-light">
                            {osmError
                              ? "Die Kartendaten konnten gerade nicht geladen werden."
                              : `Die exakte Position von Garten ${gardenNumber} wurde noch nicht auf der Karte eingezeichnet.`}{" "}
                            Die Gartendetails können Sie <span className="lg:hidden">unten</span>
                            <span className="hidden lg:inline">rechts</span> einsehen.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <GardenMap
                    selectedGarden={selectedGarden}
                    osmGeometry={osmGeometry}
                    allGardens={allGardens}
                    availableGardens={availableGardens}
                    onGardenClick={handleGardenClick}
                    defaultMapType="3d"
                    cookiePreferences={cookiePreferences}
                    onOpenCookieConsent={() => cookieConsentRef.current?.open()}
                    disable3D={selectedGarden === null}
                  />
                )}
              </Suspense>
            </div>

            <div className="lg:col-span-1 shrink-0 relative z-10 flex flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
              {/* Navigation zu vorherigem/nächstem Garten */}
              {/* WICHTIG: Beim Durchblättern werden nur Gärten angezeigt, die den aktiven Filtern entsprechen */}
              {selectedGarden && currentIndex >= 0 && (previousGarden || nextGarden) && (
                <div className="mb-4 flex items-center justify-between gap-2 bg-scholle-bg-container rounded-lg border border-scholle-border p-3 shrink-0">
                  <button
                    onClick={() => previousGarden && navigate(`/${previousGarden.number}`)}
                    disabled={!previousGarden}
                    className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                      previousGarden
                        ? "bg-scholle-green text-white hover:bg-scholle-green/90"
                        : "bg-scholle-border text-scholle-text-light cursor-not-allowed"
                    }`}
                    title={
                      previousGarden ? `Vorheriger Garten: ${previousGarden.number}` : undefined
                    }
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    <span className="text-sm font-medium">Vorheriger</span>
                  </button>

                  <div className="flex-1 text-center text-xs text-scholle-text-light">
                    {currentIndex + 1} von {availableGardens.length}
                    {filtersActive && (
                      <span className="block mt-0.5 text-scholle-green font-medium">
                        (Filter aktiv)
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => nextGarden && navigate(`/${nextGarden.number}`)}
                    disabled={!nextGarden}
                    className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                      nextGarden
                        ? "bg-scholle-green text-white hover:bg-scholle-green/90"
                        : "bg-scholle-border text-scholle-text-light cursor-not-allowed"
                    }`}
                    title={nextGarden ? `Nächster Garten: ${nextGarden.number}` : undefined}
                  >
                    <span className="text-sm font-medium">Nächster</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              )}

              <GardenDetails
                garden={selectedGarden}
                gardenNumber={gardenNumber}
                osmParcel={osmParcel}
                osmSize={osmSize}
                listUnavailable={freeGardensError}
              />
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
