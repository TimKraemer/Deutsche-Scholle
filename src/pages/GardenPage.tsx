import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GardenMap from '../components/GardenMap';
import GardenDetails from '../components/GardenDetails';
import CookieConsent from '../components/CookieConsent';
import type { CookieConsentRef } from '../components/CookieConsent';
import type { Garden } from '../types/garden';
import { findGardenByNumber } from '../data/mockGardens';
import { searchGardenByNumber, osmWayToGarden, loadAllGardens, loadGardenByWayId, findEnclosingParcel } from '../utils/osm';
import type { OSMWay } from '../utils/osm';

interface CookiePreferences {
  googleMaps: boolean;
  openStreetMap: boolean;
}

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
  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences>({
    googleMaps: false,
    openStreetMap: false,
  });
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

  // Lade Garten basierend auf URL-Parameter
  useEffect(() => {
    if (!gardenNumber) {
      navigate('/');
      return;
    }

    const loadGarden = async () => {
      setIsLoading(true);
      setError(null);
      setSelectedGarden(null);
      setOsmGeometry(undefined);
      setHasOsmData(false);

      try {
        // Zuerst in Mock-Daten suchen
        const mockGarden = findGardenByNumber(gardenNumber);
        
        // Dann in OpenStreetMap suchen (nur wenn Zustimmung gegeben)
        const osmWay = cookiePreferences.openStreetMap 
          ? await searchGardenByNumber(gardenNumber)
          : null;
        
        if (osmWay) {
          // Suche nach umschließender Parzelle
          const enclosingParcel = await findEnclosingParcel(osmWay);
          setOsmParcel(enclosingParcel);
          
          // OSM-Größe wird später aus dem Garden-Objekt extrahiert
          
          // Kombiniere OSM-Daten mit Mock-Daten
          const garden = osmWayToGarden(osmWay, mockGarden, enclosingParcel);
          
          if (garden) {
            setSelectedGarden(garden);
            setOsmSize(garden.osmSize);
            if (osmWay.geometry) {
              setOsmGeometry(osmWay.geometry);
              setHasOsmData(true);
            }
          } else {
            setError('Garten gefunden, aber Geometrie konnte nicht verarbeitet werden.');
          }
        } else if (mockGarden) {
          // Fallback: Versuche über Way ID zu laden, wenn vorhanden (nur wenn Zustimmung gegeben)
          if (mockGarden.osmWayId && cookiePreferences.openStreetMap) {
            const osmWayById = await loadGardenByWayId(mockGarden.osmWayId);
            
            if (osmWayById) {
              // Suche nach umschließender Parzelle
              const enclosingParcel = await findEnclosingParcel(osmWayById);
              setOsmParcel(enclosingParcel);
              
              // OSM-Größe wird später aus dem Garden-Objekt extrahiert
              
              const garden = osmWayToGarden(osmWayById, mockGarden, enclosingParcel);
              if (garden) {
                setSelectedGarden(garden);
                setOsmSize(garden.osmSize);
                if (osmWayById.geometry) {
                  setOsmGeometry(osmWayById.geometry);
                  setHasOsmData(true);
                }
              } else {
                setSelectedGarden(mockGarden);
                setError('Garten gefunden, aber Geometrie konnte nicht verarbeitet werden.');
              }
            } else {
              // Garten in DB, aber nicht in OSM gefunden
              setSelectedGarden(mockGarden);
              setHasOsmData(false);
              // Kein Fehler setzen - Hinweis wird in der Karten-Box angezeigt
            }
          } else {
            // Garten in DB, aber keine OSM-Zustimmung oder kein osmWayId
            setSelectedGarden(mockGarden);
            setHasOsmData(false);
            // Kein Fehler setzen - Hinweis wird in der Karten-Box angezeigt oder CookieConsentHint
          }
        } else {
          // Garten weder in Mock-Daten noch in OSM gefunden
          // Aber wenn OSM-Zustimmung nicht gegeben ist, könnte der Garten trotzdem existieren
          if (!cookiePreferences.openStreetMap) {
            setError(`Garten mit Nummer "${gardenNumber}" nicht gefunden. Bitte aktivieren Sie OpenStreetMap in den Cookie-Einstellungen, um auch Gärten zu finden, die nur in OSM vorhanden sind.`);
          } else {
            setError(`Garten mit Nummer "${gardenNumber}" nicht gefunden.`);
          }
        }
      } catch (err) {
        console.error('Search error:', err);
        setError('Fehler bei der Suche. Bitte versuchen Sie es erneut.');
      } finally {
        setIsLoading(false);
      }
    };

    loadGarden();
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
      <div className="h-screen bg-scholle-bg flex flex-col overflow-hidden">
        <div className="container mx-auto px-4 py-8 flex-shrink-0">
          <header className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={() => navigate('/')}
                className="text-scholle-blue hover:text-scholle-blue-dark transition-colors font-medium"
              >
                ← Zurück zur Übersicht
              </button>
            </div>
            <h1 className="text-4xl font-bold text-scholle-text mb-2">
              Garten {gardenNumber}
            </h1>
            <p className="text-scholle-text-light text-lg">
              Kleingartenverein Deutsche Scholle
            </p>
          </header>

          {error && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
              {error}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-0 px-4 pb-4 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden">
            <div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden">
              {hasOsmData && osmGeometry ? (
                <GardenMap 
                  selectedGarden={selectedGarden} 
                  osmGeometry={osmGeometry}
                  allGardens={allGardens}
                  onGardenClick={handleGardenClick}
                  defaultMapType="3d"
                  cookiePreferences={cookiePreferences}
                  onOpenCookieConsent={() => cookieConsentRef.current?.open()}
                  disable3D={selectedGarden === null}
                />
              ) : selectedGarden && !hasOsmData && cookiePreferences.openStreetMap ? (
                <div className="flex-1 min-h-[350px] bg-scholle-bg-light rounded-lg border border-scholle-border flex items-center justify-center">
                  <div className="bg-scholle-bg-container rounded-lg border border-scholle-border shadow-sm p-6 max-w-2xl w-full">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-scholle-text mb-2">
                          Kartenansicht nicht verfügbar
                        </h3>
                        <p className="text-base text-scholle-text-light">
                          Die exakte Position von Garten {gardenNumber} wurde noch nicht auf der Karte eingezeichnet. 
                          Die Gartendetails können Sie rechts einsehen.
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
                  onGardenClick={handleGardenClick}
                  defaultMapType="3d"
                  cookiePreferences={cookiePreferences}
                  onOpenCookieConsent={() => cookieConsentRef.current?.open()}
                  disable3D={selectedGarden === null}
                />
              )}
            </div>
            
            <div className="lg:col-span-1 flex-shrink-0 relative z-10 flex flex-col min-h-0 overflow-hidden">
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
      </div>
    </>
  );
}

