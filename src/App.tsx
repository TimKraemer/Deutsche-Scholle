import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import GardenSearch from './components/GardenSearch';
import GardenMap from './components/GardenMap';
import GardenList from './components/GardenList';
import CookieConsent from './components/CookieConsent';
import type { CookieConsentRef } from './components/CookieConsent';
import CookieConsentContent from './components/CookieConsentContent';
import { loadAllGardens, loadAllGardensWithUpdate, searchGardenByNumber, searchGardenByNumberWithUpdate } from './utils/osm';
import type { OSMWay } from './utils/osm';
import { findGardenByNumber, mockGardens } from './data/mockGardens';

interface CookiePreferences {
  googleMaps: boolean;
  openStreetMap: boolean;
}

function App() {
  const navigate = useNavigate();
  const [allGardens, setAllGardens] = useState<OSMWay[]>([]);
  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences>({
    googleMaps: false,
    openStreetMap: false,
  });
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hoveredGardenNumber, setHoveredGardenNumber] = useState<string | null>(null);
  const cookieConsentRef = useRef<CookieConsentRef>(null);

  // Lade initiale Cookie-Präferenzen beim Start
  useEffect(() => {
    const getCookie = (name: string): string | null => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null;
      }
      return null;
    };

    const savedGoogleMaps = getCookie('cookie_consent_google_maps');
    const savedOSM = getCookie('cookie_consent_openstreetmap');

    if (savedGoogleMaps !== null && savedOSM !== null) {
      setCookiePreferences({
        googleMaps: savedGoogleMaps === 'true',
        openStreetMap: savedOSM === 'true',
      });
    }
  }, []);

  const handleConsentChange = (preferences: { googleMaps: boolean | null; openStreetMap: boolean | null }) => {
    setCookiePreferences({
      googleMaps: preferences.googleMaps === true,
      openStreetMap: preferences.openStreetMap === true,
    });
  };

  // Lade alle Gärten nur wenn OSM-Zustimmung gegeben wurde
  useEffect(() => {
    if (!cookiePreferences.openStreetMap) {
      return;
    }

    // Hybrid-Ansatz: Zeige sofort gecachte Daten, aktualisiere im Hintergrund
    // Verwende forceRefresh=false für Background-Update, damit neue Gärten gefunden werden
    const cachedGardens = loadAllGardensWithUpdate((updatedGardens) => {
      // Callback wird aufgerufen wenn neue Daten verfügbar sind
      setAllGardens(updatedGardens);
    });
    
    // Setze sofort gecachte Daten (falls vorhanden)
    if (cachedGardens.length > 0) {
      setAllGardens(cachedGardens);
    } else {
      // Wenn kein Cache vorhanden, lade sofort (ohne Cache)
      loadAllGardens(false).then((gardens: OSMWay[]) => {
        if (gardens.length > 0) {
          setAllGardens(gardens);
        }
      }).catch((err: any) => {
        console.error('Error loading all gardens:', err);
      });
    }
  }, [cookiePreferences.openStreetMap]);

  const handleSearch = async (gardenNumber: string) => {
    setSearchError(null);
    
    // Prüfe zuerst ob der Garten in den Mock-Daten existiert
    const garden = findGardenByNumber(gardenNumber);
    
    if (garden) {
      // Garten in Datenbank gefunden, navigiere direkt
      navigate(`/${gardenNumber}`);
      return;
    }
    
    // Wenn nicht in Datenbank, prüfe in OSM (nur wenn Zustimmung gegeben)
    if (cookiePreferences.openStreetMap) {
      // Hybrid-Ansatz: Zeige sofort gecachte Daten, aktualisiere im Hintergrund
      const cachedOsmWay = searchGardenByNumberWithUpdate(gardenNumber, (updatedWay) => {
        // Callback wird aufgerufen wenn neue Daten verfügbar sind
        // Navigiere nur wenn noch auf der Startseite
        if (updatedWay && window.location.pathname === '/') {
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
        const osmWay = await searchGardenByNumber(gardenNumber, true);
        if (osmWay) {
          // Garten in OSM gefunden, navigiere zur Detailseite
          navigate(`/${gardenNumber}`);
          return;
        }
      } catch (err) {
        console.error('Error searching in OSM:', err);
        // Weiter mit Fehlerbehandlung
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
      <div className="h-screen bg-scholle-bg flex flex-col overflow-hidden">
        <div className="container mx-auto px-4 py-8 flex-shrink-0">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-scholle-text mb-2">
              Kleingartenverein Deutsche Scholle
            </h1>
            <p className="text-scholle-text-light">
              Finden Sie freie Gärten auf der Karte
            </p>
          </header>

          <div className="mb-6">
            <GardenSearch onSearch={handleSearch} isLoading={false} error={searchError} onErrorDismiss={() => setSearchError(null)} />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 px-4 pb-4 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden">
            {/* Liste der freien Gärten */}
            <div className="lg:col-span-1 flex flex-col min-h-0 overflow-hidden">
              <GardenList 
                gardens={mockGardens} 
                onGardenClick={handleGardenClick}
                hoveredGardenNumber={hoveredGardenNumber}
                onGardenHover={setHoveredGardenNumber}
              />
            </div>

            {/* Karte */}
            <div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 min-h-[350px] flex flex-col relative">
                {/* Graue Box als Platzhalter für die Karte */}
                <div className="absolute inset-0 bg-scholle-border rounded-lg border border-scholle-border" />
                
                {cookiePreferences.openStreetMap ? (
                  <GardenMap 
                    selectedGarden={null} 
                    osmGeometry={undefined}
                    allGardens={allGardens}
                    availableGardens={mockGardens.filter(g => g.availableFrom && g.availableFrom.trim() !== '')}
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
                      <CookieConsentContent 
                        onConsentChange={handleConsentChange}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
