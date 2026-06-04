import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CookieConsentRef } from "../components/CookieConsent";
import CookieConsent from "../components/CookieConsent";
import GardenDetails from "../components/GardenDetails";
import { findGardenByNumber, mockGardens } from "../data/mockGardens";
import { useCookiePreferences } from "../hooks/useCookiePreferences";
import type { Garden } from "../types/garden";
import { gardenValueToNumber } from "../utils/formatting";
import {
  applyGardenFilters,
  hasActiveFilters,
  loadFiltersFromStorage,
} from "../utils/gardenFilters";
import {
  filterAvailableGardens,
  type SortDirection,
  type SortOption,
  sortGardens,
} from "../utils/gardenSort";
import type { OSMWay } from "../utils/osm";
import {
  findEnclosingParcel,
  loadAllGardensWithUpdate,
  osmWayToGarden,
  searchGardenByNumber,
} from "../utils/osm";

// Karte (Leaflet) lazy laden: schwerste Abhängigkeit, getrennter Chunk
const GardenMap = lazy(() => import("../components/GardenMap"));

export default function GardenPage() {
  const { gardenNumber } = useParams<{ gardenNumber: string }>();
  const navigate = useNavigate();
  const [selectedGarden, setSelectedGarden] = useState<Garden | null>(null);
  const [osmGeometry, setOsmGeometry] = useState<Array<{ lat: number; lon: number }> | undefined>();
  const [allGardens, setAllGardens] = useState<OSMWay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [osmParcel, setOsmParcel] = useState<string | null>(null);
  const [osmSize, setOsmSize] = useState<number | undefined>(undefined);
  const [hasOsmData, setHasOsmData] = useState<boolean>(false); // Track ob OSM-Daten vorhanden sind
  const [osmLoading, setOsmLoading] = useState<boolean>(false); // OSM-Karte wird im Hintergrund geladen
  const { cookiePreferences, handleConsentChange } = useCookiePreferences();
  // Lade Sortierung aus localStorage (synchronisiert mit Startseite)
  // Standardmäßig nach Nummer sortieren wenn keine gültige Einstellung gespeichert ist
  const [sortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem("gardenSortBy");
    const validOptions: SortOption[] = ["number", "availableFrom", "size", "valuation"];
    return validOptions.includes(saved as SortOption) ? (saved as SortOption) : "number";
  });

  const [sortDirection] = useState<SortDirection>(() => {
    const saved = localStorage.getItem("gardenSortDirection");
    return saved === "asc" || saved === "desc" ? saved : "asc";
  });
  const cookieConsentRef = useRef<CookieConsentRef>(null);

  // Berechne Liste der freien Gärten mit Filterung und Sortierung (wie auf Startseite)
  // WICHTIG: Filter werden berücksichtigt - beim Durchblättern werden nur gefilterte Gärten angezeigt
  const { availableGardens, ranges, activeFilters } = useMemo(() => {
    // Schritt 1: Filtere verfügbare Gärten (availableFrom gesetzt)
    const available = filterAvailableGardens(mockGardens);

    if (available.length === 0) {
      // Fallback wenn keine verfügbaren Gärten
      const defaultRanges = {
        minPrice: 0,
        maxPrice: 1200,
        minSize: 350,
        maxSize: 450,
        defaultMinPrice: 0,
        defaultMaxPrice: 1200,
        defaultMinSize: 350,
        defaultMaxSize: 450,
      };
      const filters = loadFiltersFromStorage({
        minPrice: defaultRanges.defaultMinPrice,
        maxPrice: defaultRanges.defaultMaxPrice,
        minSize: defaultRanges.defaultMinSize,
        maxSize: defaultRanges.defaultMaxSize,
      });
      return {
        availableGardens: [],
        ranges: defaultRanges,
        activeFilters: filters,
      };
    }

    // Schritt 2: Berechne echte Min/Max-Werte aus der Datenbank
    const prices = available.map((g) => gardenValueToNumber(g.valuation)).filter((p) => p >= 0);
    const sizes = available.map((g) => g.size).filter((s) => s > 0);

    const realMinPrice = Math.min(...prices, 0);
    const realMaxPrice = Math.max(...prices, 0);
    const realMinSize = Math.min(...sizes);
    const realMaxSize = Math.max(...sizes);

    // Schritt 3: Berechne gerundete Werte für Initialisierung
    // WICHTIG: Gerundete Werte dürfen nicht über die echten Maximalwerte hinausgehen
    // und nicht unter die echten Minimalwerte fallen
    const defaultMinPrice = Math.max(Math.floor(realMinPrice / 50) * 50, realMinPrice); // Begrenze auf echten Minimalwert
    const defaultMaxPrice = Math.min(Math.ceil(realMaxPrice / 50) * 50, realMaxPrice); // Begrenze auf echten Maximalwert
    const defaultMinSize = Math.max(Math.floor(realMinSize / 10) * 10, realMinSize); // Begrenze auf echten Minimalwert
    const defaultMaxSize = Math.min(Math.ceil(realMaxSize / 10) * 10, realMaxSize); // Begrenze auf echten Maximalwert

    const calculatedRanges = {
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

    // Schritt 4: Lade aktive Filter aus localStorage (synchronisiert mit Startseite)
    const filters = loadFiltersFromStorage({
      minPrice: calculatedRanges.defaultMinPrice,
      maxPrice: calculatedRanges.defaultMaxPrice,
      minSize: calculatedRanges.defaultMinSize,
      maxSize: calculatedRanges.defaultMaxSize,
    });

    // Schritt 5: Wende Filter an (nur gefilterte Gärten werden beim Durchblättern berücksichtigt)
    const filtered = applyGardenFilters(available, filters);

    // Schritt 6: Sortiere nach ausgewählter Option und Richtung
    const sorted = sortGardens(filtered, sortBy, sortDirection);

    return {
      availableGardens: sorted,
      ranges: calculatedRanges,
      activeFilters: filters,
    };
  }, [sortBy, sortDirection]);

  // Prüfe ob Filter aktiv sind (vergleiche mit gerundeten Standard-Werten)
  const filtersActive = useMemo(
    () =>
      hasActiveFilters(activeFilters, {
        minPrice: ranges.defaultMinPrice,
        maxPrice: ranges.defaultMaxPrice,
        minSize: ranges.defaultMinSize,
        maxSize: ranges.defaultMaxSize,
      }),
    [activeFilters, ranges]
  );

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

  // Lade alle Gärten nur wenn OSM-Zustimmung gegeben wurde
  useEffect(() => {
    if (!cookiePreferences.openStreetMap) {
      return;
    }

    // Hybrid-Ansatz: Zeige sofort gecachte Daten, aktualisiere im Hintergrund
    const cachedGardens = loadAllGardensWithUpdate((updatedGardens) => {
      // Callback wird aufgerufen wenn neue Daten verfügbar sind
      setAllGardens(updatedGardens);
    });

    // Setze sofort gecachte Daten (falls vorhanden)
    if (cachedGardens.length > 0) {
      setAllGardens(cachedGardens);
    }
  }, [cookiePreferences.openStreetMap]);

  // Lade Garten basierend auf URL-Parameter
  // Strategie: Datenbank-Daten SOFORT anzeigen, OSM-Karte im Hintergrund nachladen.
  // Warum? Die Overpass-API kann mehrere Sekunden brauchen - das darf die Anzeige
  // der bereits vorhandenen Gartendetails (Größe, Preis, Verfügbarkeit) nicht blockieren.
  useEffect(() => {
    if (!gardenNumber) {
      navigate("/");
      return;
    }

    // Verhindert State-Updates, wenn der Nutzer währenddessen zu einem anderen Garten wechselt
    let cancelled = false;

    // OSM-spezifische Daten beim Gartenwechsel zurücksetzen
    setError(null);
    setOsmGeometry(undefined);
    setOsmParcel(null);
    setOsmSize(undefined);
    setHasOsmData(false);

    // Datenbank-Daten sofort anzeigen (kein Warten auf das Netzwerk)
    const mockGarden = findGardenByNumber(gardenNumber);
    setSelectedGarden(mockGarden ?? null);

    // Vollbild-Spinner nur, wenn wir keine Daten haben und auf OSM warten müssen
    setIsLoading(!mockGarden && cookiePreferences.openStreetMap);

    if (!cookiePreferences.openStreetMap) {
      if (!mockGarden) {
        setError(
          `Garten mit Nummer "${gardenNumber}" nicht gefunden. Bitte aktivieren Sie OpenStreetMap in den Cookie-Einstellungen, um auch Gärten zu finden, die nur in OSM vorhanden sind.`
        );
      }
      return;
    }

    // OSM-Anreicherung im Hintergrund (Karte, Umrisse, umschließende Parzelle)
    setOsmLoading(true);

    const enrichWithOsm = async () => {
      try {
        const osmWay = await searchGardenByNumber(gardenNumber);
        if (cancelled) return;

        if (osmWay) {
          const enclosingParcel = await findEnclosingParcel(osmWay);
          if (cancelled) return;

          setOsmParcel(enclosingParcel);
          const garden = osmWayToGarden(osmWay, mockGarden, enclosingParcel);

          if (garden) {
            setSelectedGarden(garden);
            setOsmSize(garden.osmSize);
            if (osmWay.geometry) {
              setOsmGeometry(osmWay.geometry);
              setHasOsmData(true);
            }
          } else if (!mockGarden) {
            setError("Garten gefunden, aber Geometrie konnte nicht verarbeitet werden.");
          }
        } else if (!mockGarden) {
          setError(`Garten mit Nummer "${gardenNumber}" nicht gefunden.`);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Search error:", err);
        // Fehler nur anzeigen, wenn keine Datenbank-Daten als Fallback vorliegen
        if (!mockGarden) {
          setError("Fehler bei der Suche. Bitte versuchen Sie es erneut.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setOsmLoading(false);
        }
      }
    };

    enrichWithOsm();

    return () => {
      cancelled = true;
    };
  }, [gardenNumber, navigate, cookiePreferences.openStreetMap]);

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
      <CookieConsent ref={cookieConsentRef} onConsentChange={handleConsentChange} />
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
                            Die exakte Position von Garten {gardenNumber} wurde noch nicht auf der
                            Karte eingezeichnet. Die Gartendetails können Sie{" "}
                            <span className="lg:hidden">unten</span>
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
                osmGeometry={osmGeometry}
                gardenNumber={gardenNumber}
                osmParcel={osmParcel}
                osmSize={osmSize}
              />
            </div>
          </div>
        </div>

        {/* Footer mit Hinweis zu Fehlern */}
        <div className="shrink-0 border-t border-scholle-border bg-scholle-bg-light px-4 py-2">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-scholle-text-light text-center">
            <span>
              Fehler in der Karte? Bitte melden Sie diese an{" "}
              <a
                href="mailto:scholle-map@tk22.de"
                className="text-scholle-blue hover:text-scholle-blue-dark underline"
              >
                scholle-map@tk22.de
              </a>{" "}
              oder direkt beim Verein.
            </span>
            <a
              href="https://github.com/TimKraemer/Deutsche-Scholle"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-scholle-blue hover:text-scholle-blue-dark"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4" fill="currentColor">
                <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
              </svg>
              Quellcode auf GitHub
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
