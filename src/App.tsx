import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CookieConsentRef } from "./components/CookieConsent";
import CookieConsent from "./components/CookieConsent";
import CookieConsentContent from "./components/CookieConsentContent";
import Footer from "./components/Footer";
import GardenList from "./components/GardenList";
import GardenSearch from "./components/GardenSearch";
import { useCookiePreferences } from "./hooks/useCookiePreferences";
import { useFreeGardens } from "./hooks/useFreeGardens";
import { useGardenData } from "./hooks/useGardenData";
import type { Garden } from "./types/garden";
import { findGardenByNumber } from "./utils/freeGardens";
import { findOsmGarden, getGardenData } from "./utils/osm";

// Karte (Leaflet) lazy laden: schwerste Abhängigkeit, wird erst nach OSM-Zustimmung gerendert
const GardenMap = lazy(() => import("./components/GardenMap"));

function App() {
  const navigate = useNavigate();
  const { cookiePreferences, handleConsentChange } = useCookiePreferences();
  const { allGardens } = useGardenData(cookiePreferences.openStreetMap);
  const freeGardens = useFreeGardens();
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hoveredGardenNumber, setHoveredGardenNumber] = useState<string | null>(null);
  const [filteredGardens, setFilteredGardens] = useState<Garden[]>([]);
  const cookieConsentRef = useRef<CookieConsentRef>(null);

  const handleFilteredGardensChange = useCallback((gardens: Garden[]) => {
    setFilteredGardens(gardens);
  }, []);

  const handleSearch = async (gardenNumber: string) => {
    setSearchError(null);

    // Prüfe zuerst ob der Garten in der Liste der freien Gärten steht
    // - Liste ist bereits geladen, schneller als die OSM-Daten
    // - Enthält zusätzliche Informationen (Preis, Verfügbarkeit, etc.)
    const garden = findGardenByNumber(freeGardens.gardens, gardenNumber);

    if (garden) {
      // Garten in Datenbank gefunden, navigiere direkt
      navigate(`/${gardenNumber}`);
      return;
    }

    // Wenn nicht in Datenbank, prüfe in OSM (nur wenn Zustimmung gegeben)
    // Einige Gärten existieren nur in OSM (noch nicht in Datenbank)
    if (cookiePreferences.openStreetMap) {
      try {
        const data = await getGardenData();
        if (findOsmGarden(data, gardenNumber)) {
          navigate(`/${gardenNumber}`);
          return;
        }
      } catch (err) {
        console.error("Error searching in OSM:", err);
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
                gardens={freeGardens.gardens}
                changedAt={freeGardens.changedAt}
                isLoading={freeGardens.isLoading}
                hasError={freeGardens.hasError}
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

        <Footer />
      </div>
    </>
  );
}

export default App;
