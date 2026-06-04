import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CookieConsentRef } from "./components/CookieConsent";
import CookieConsent from "./components/CookieConsent";
import CookieConsentContent from "./components/CookieConsentContent";
import GardenList from "./components/GardenList";
import GardenSearch from "./components/GardenSearch";
import { findGardenByNumber, mockGardens } from "./data/mockGardens";
import { useCookiePreferences } from "./hooks/useCookiePreferences";
import type { Garden } from "./types/garden";
import type { OSMWay } from "./utils/osm";
import {
  loadAllGardens,
  loadAllGardensWithUpdate,
  searchGardenByNumber,
  searchGardenByNumberWithUpdate,
} from "./utils/osm";

// Karte (Leaflet) lazy laden: schwerste Abhängigkeit, wird erst nach OSM-Zustimmung gerendert
const GardenMap = lazy(() => import("./components/GardenMap"));

function App() {
  const navigate = useNavigate();
  const { cookiePreferences, handleConsentChange } = useCookiePreferences();
  const [allGardens, setAllGardens] = useState<OSMWay[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hoveredGardenNumber, setHoveredGardenNumber] = useState<string | null>(null);
  const [filteredGardens, setFilteredGardens] = useState<Garden[]>([]);
  const cookieConsentRef = useRef<CookieConsentRef>(null);

  const handleFilteredGardensChange = useCallback((gardens: Garden[]) => {
    setFilteredGardens(gardens);
  }, []);

  // Lade alle Gärten nur wenn OSM-Zustimmung gegeben wurde
  // Warum Cookie-Check?
  // - DSGVO-konform: Keine API-Calls ohne Zustimmung
  // - Verhindert unnötige Requests wenn Benutzer OSM nicht aktiviert hat
  useEffect(() => {
    if (!cookiePreferences.openStreetMap) {
      return;
    }

    // Hybrid-Ansatz: Zeige sofort gecachte Daten, aktualisiere im Hintergrund
    // Warum?
    // - Sofortige Anzeige für bessere UX (kein Warten auf großen API-Request)
    // - Hintergrund-Update stellt sicher, dass neue Gärten gefunden werden
    const cachedGardens = loadAllGardensWithUpdate((updatedGardens) => {
      // Callback wird aufgerufen wenn neue Daten verfügbar sind
      setAllGardens(updatedGardens);
    });

    // Setze sofort gecachte Daten (falls vorhanden)
    if (cachedGardens.length > 0) {
      setAllGardens(cachedGardens);
    } else {
      // Wenn kein Cache vorhanden, lade sofort (ohne Cache)
      // Fallback für ersten Besuch oder nach Cache-Löschung
      loadAllGardens(false)
        .then((gardens: OSMWay[]) => {
          if (gardens.length > 0) {
            setAllGardens(gardens);
          }
        })
        .catch((err: unknown) => {
          console.error("Error loading all gardens:", err);
        });
    }
  }, [cookiePreferences.openStreetMap]);

  const handleSearch = async (gardenNumber: string) => {
    setSearchError(null);

    // Prüfe zuerst ob der Garten in den Mock-Daten existiert
    // Warum zuerst Mock-Daten?
    // - Lokale Datenbank ist schneller als API-Request
    // - Enthält zusätzliche Informationen (Preis, Verfügbarkeit, etc.)
    const garden = findGardenByNumber(gardenNumber);

    if (garden) {
      // Garten in Datenbank gefunden, navigiere direkt
      navigate(`/${gardenNumber}`);
      return;
    }

    // Wenn nicht in Datenbank, prüfe in OSM (nur wenn Zustimmung gegeben)
    // Warum OSM-Check?
    // - Einige Gärten existieren nur in OSM (noch nicht in Datenbank)
    // - Ermöglicht Suche auch für nicht-verfügbare Gärten
    if (cookiePreferences.openStreetMap) {
      // Hybrid-Ansatz: Zeige sofort gecachte Daten, aktualisiere im Hintergrund
      const cachedOsmWay = searchGardenByNumberWithUpdate(gardenNumber, (updatedWay) => {
        // Callback wird aufgerufen wenn neue Daten verfügbar sind
        // Navigiere nur wenn noch auf der Startseite (verhindert Navigation während User bereits navigiert)
        if (updatedWay && window.location.pathname === "/") {
          navigate(`/${gardenNumber}`);
        }
      });

      if (cachedOsmWay) {
        // Garten in OSM Cache gefunden, navigiere zur Detailseite
        navigate(`/${gardenNumber}`);
        return;
      }

      // Wenn kein Cache vorhanden, warte auf OSM-Request
      try {
        // Versuche mit forceRefresh um sicherzustellen, dass wir die neuesten Daten bekommen
        // Warum forceRefresh?
        // - Bei Suche wollen wir aktuelle Daten (Garten könnte gerade hinzugefügt worden sein)
        const osmWay = await searchGardenByNumber(gardenNumber, true);
        if (osmWay) {
          // Garten in OSM gefunden, navigiere zur Detailseite
          navigate(`/${gardenNumber}`);
          return;
        }
      } catch (err) {
        console.error("Error searching in OSM:", err);
        // Weiter mit Fehlerbehandlung (zeigt Fehlermeldung unten)
      }
    }

    // Garten weder in Datenbank noch in OSM gefunden
    setSearchError(`Garten mit Nummer "${gardenNumber}" wurde nicht gefunden.`);
  };

  const handleGardenClick = (gardenNumber: string) => {
    navigate(`/${gardenNumber}`);
  };

  return (
    <>
      <CookieConsent ref={cookieConsentRef} onConsentChange={handleConsentChange} />
      <div className="min-h-screen bg-scholle-bg flex flex-col lg:h-screen lg:overflow-hidden">
        <div className="container mx-auto px-4 py-4 shrink-0">
          {/* Header und Suche nebeneinander auf großen Bildschirmen */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <header className="shrink-0">
              <h1 className="text-2xl lg:text-3xl font-bold text-scholle-text mb-1">
                Kleingartenverein Deutsche Scholle
              </h1>
              <p className="text-sm lg:text-base text-scholle-text-light">
                Finden Sie freie Gärten auf der Karte
              </p>
            </header>

            <div className="shrink-0 lg:w-96">
              <GardenSearch
                onSearch={handleSearch}
                isLoading={false}
                error={searchError}
                onErrorDismiss={() => setSearchError(null)}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col px-4 pb-4 lg:min-h-0 lg:overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
            {/* Liste der freien Gärten */}
            <div className="lg:col-span-1 flex flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
              <GardenList
                gardens={mockGardens}
                onGardenClick={handleGardenClick}
                hoveredGardenNumber={hoveredGardenNumber}
                onGardenHover={setHoveredGardenNumber}
                onFilteredGardensChange={handleFilteredGardensChange}
              />
            </div>

            {/* Karte */}
            <div className="lg:col-span-2 flex flex-col min-h-0 lg:overflow-hidden">
              <div
                className={`flex-1 min-h-[350px] lg:min-h-[350px] lg:aspect-auto flex flex-col relative ${
                  cookiePreferences.openStreetMap ? "aspect-square" : ""
                }`}
              >
                {/* Graue Box als Platzhalter für die Karte */}
                <div className="absolute inset-0 bg-scholle-border rounded-lg border border-scholle-border" />

                {cookiePreferences.openStreetMap ? (
                  <Suspense fallback={null}>
                    <GardenMap
                      selectedGarden={null}
                      osmGeometry={undefined}
                      allGardens={allGardens}
                      availableGardens={filteredGardens}
                      hoveredGardenNumber={hoveredGardenNumber}
                      onGardenHover={setHoveredGardenNumber}
                      onGardenClick={handleGardenClick}
                      cookiePreferences={cookiePreferences}
                      onOpenCookieConsent={() => cookieConsentRef.current?.open()}
                      disable3D={true}
                    />
                  </Suspense>
                ) : (
                  <div className="relative z-10 w-full lg:h-full flex items-center justify-center p-4 sm:p-8 lg:overflow-y-auto">
                    <CookieConsentContent embedded onConsentChange={handleConsentChange} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer mit Hinweis zu Fehlern */}
        <div className="shrink-0 border-t border-scholle-border bg-scholle-bg-light px-4 py-2">
          <p className="text-xs text-scholle-text-light text-center">
            Fehler in der Karte? Bitte melden Sie diese an{" "}
            <a
              href="mailto:scholle-map@tk22.de"
              className="text-scholle-blue hover:text-scholle-blue-dark underline"
            >
              scholle-map@tk22.de
            </a>{" "}
            oder direkt beim Verein.
          </p>
          <p className="text-xs text-scholle-text-light text-center mt-1">
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
          </p>
        </div>
      </div>
    </>
  );
}

export default App;
