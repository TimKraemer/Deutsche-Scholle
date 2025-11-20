import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import GardenSearch from './components/GardenSearch';
import GardenMap from './components/GardenMap';
import CookieConsent from './components/CookieConsent';
import type { CookieConsentRef } from './components/CookieConsent';
import CookieConsentContent from './components/CookieConsentContent';
import { loadAllGardens, searchGardenByNumber } from './utils/osm';
import type { OSMWay } from './utils/osm';
import { findGardenByNumber } from './data/mockGardens';

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

    const fetchAllGardens = async () => {
      try {
        const gardens = await loadAllGardens();
        setAllGardens(gardens);
      } catch (err) {
        console.error('Error loading all gardens:', err);
      }
    };
    
    fetchAllGardens();
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
      try {
        const osmWay = await searchGardenByNumber(gardenNumber);
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
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <div className="container mx-auto px-4 py-8 flex-shrink-0">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Kleingartenverein Deutsche Scholle
            </h1>
            <p className="text-gray-600">
              Finden Sie freie Gärten auf der Karte
            </p>
          </header>

          <div className="mb-6">
            <GardenSearch onSearch={handleSearch} isLoading={false} error={searchError} onErrorDismiss={() => setSearchError(null)} />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 px-4 pb-4">
          <div className="flex-1 min-h-[350px] flex flex-col relative">
            {/* Graue Box als Platzhalter für die Karte */}
            <div className="absolute inset-0 bg-gray-200 rounded-lg border border-gray-300" />
            
            {cookiePreferences.openStreetMap ? (
              <GardenMap 
                selectedGarden={null} 
                osmGeometry={undefined}
                allGardens={allGardens}
                onGardenClick={handleGardenClick}
                cookiePreferences={cookiePreferences}
                onOpenCookieConsent={() => cookieConsentRef.current?.open()}
              />
            ) : (
              <div className="relative z-10 w-full h-full flex items-center justify-center p-8">
                <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg">
                  <CookieConsentContent 
                    onConsentChange={handleConsentChange}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
