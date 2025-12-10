import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CookieConsentRef } from "./components/CookieConsent";
import CookieConsent from "./components/CookieConsent";
import CookieConsentContent from "./components/CookieConsentContent";
import GardenList from "./components/GardenList";
import GardenMap from "./components/GardenMap";
import GardenSearch from "./components/GardenSearch";
import { findGardenByNumber, mockGardens } from "./data/mockGardens";
import type { CookiePreferences } from "./types/cookies";
import { loadCookiePreferences } from "./utils/cookies";
import type { OSMWay } from "./utils/osm";
import {
  loadAllGardens,
  loadAllGardensWithUpdate,
  searchGardenByNumber,
  searchGardenByNumberWithUpdate,
} from "./utils/osm";

function App() {
  const navigate = useNavigate();
  const [allGardens, setAllGardens] = useState<OSMWay[]>([]);
  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences>({
    googleMaps: false,
    openStreetMap: false,
  });
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hoveredGardenNumber, setHoveredGardenNumber] = useState<string | null>(null);
  const [filteredGardens, setFilteredGardens] = useState<Garden[]>([]);
  const cookieConsentRef = useRef<CookieConsentRef>(null);

  const handleFilteredGardensChange = useCallback((gardens: Garden[]) => {
    setFilteredGardens(gardens);
  }, []);

  // Lade initiale Cookie-Präferenzen beim Start
  useEffect(() => {
    const preferences = loadCookiePreferences();
    setCookiePreferences(preferences);
  }, []);

  const handleConsentChange = useCallback(
    (preferences: { googleMaps: boolean | null; openStreetMap: boolean | null }) => {
      setCookiePreferences({
        googleMaps: preferences.googleMaps === true,
        openStreetMap: preferences.openStreetMap === true,
      });
    },
    []
  );

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
            <div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 min-h-[350px] lg:min-h-[350px] aspect-square lg:aspect-auto flex flex-col relative">
                {/* Graue Box als Platzhalter für die Karte */}
                <div className="absolute inset-0 bg-scholle-border rounded-lg border border-scholle-border" />

                {cookiePreferences.openStreetMap ? (
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
                ) : (
                  <div className="relative z-10 w-full h-full flex items-center justify-center p-8">
                    <div className="max-w-2xl w-full bg-scholle-bg-container rounded-lg shadow-lg border border-scholle-border">
                      <CookieConsentContent onConsentChange={handleConsentChange} />
                    </div>
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
        </div>
      </div>
    </>
  );
}

export default App;
