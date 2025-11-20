import { useState, useEffect } from 'react';
import GardenSearch from './components/GardenSearch';
import GardenMap from './components/GardenMap';
import GardenDetails from './components/GardenDetails';
import type { Garden } from './types/garden';
import { findGardenByNumber } from './data/mockGardens';
import { searchGardenByNumber, osmWayToGarden, loadAllGardens, loadGardenByWayId } from './utils/osm';
import type { OSMWay } from './utils/osm';

function App() {
  const [selectedGarden, setSelectedGarden] = useState<Garden | null>(null);
  const [osmGeometry, setOsmGeometry] = useState<Array<{ lat: number; lon: number }> | undefined>();
  const [allGardens, setAllGardens] = useState<OSMWay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lade alle Gärten beim Start
  useEffect(() => {
    const fetchAllGardens = async () => {
      try {
        const gardens = await loadAllGardens();
        setAllGardens(gardens);
      } catch (err) {
        console.error('Error loading all gardens:', err);
      }
    };
    
    fetchAllGardens();
  }, []);

  const handleSearch = async (gardenNumber: string) => {
    setIsLoading(true);
    setError(null);
    setSelectedGarden(null);
    setOsmGeometry(undefined);

    try {
      // Zuerst in Mock-Daten suchen
      const mockGarden = findGardenByNumber(gardenNumber);
      
      // Dann in OpenStreetMap suchen
      const osmWay = await searchGardenByNumber(gardenNumber);
      
      if (osmWay) {
        // Kombiniere OSM-Daten mit Mock-Daten
        const garden = osmWayToGarden(osmWay, mockGarden);
        
        if (garden) {
          setSelectedGarden(garden);
          if (osmWay.geometry) {
            setOsmGeometry(osmWay.geometry);
          }
        } else {
          setError('Garten gefunden, aber Geometrie konnte nicht verarbeitet werden.');
        }
      } else if (mockGarden) {
        // Fallback: Versuche über Way ID zu laden, wenn vorhanden
        if (mockGarden.osmWayId) {
          const osmWayById = await loadGardenByWayId(mockGarden.osmWayId);
          
          if (osmWayById) {
            const garden = osmWayToGarden(osmWayById, mockGarden);
            if (garden) {
              setSelectedGarden(garden);
              if (osmWayById.geometry) {
                setOsmGeometry(osmWayById.geometry);
              }
            } else {
              setSelectedGarden(mockGarden);
              setError('Garten gefunden, aber Geometrie konnte nicht verarbeitet werden.');
            }
          } else {
            setSelectedGarden(mockGarden);
            setError('Garten nicht in OpenStreetMap gefunden. Zeige Mock-Daten.');
          }
        } else {
          setSelectedGarden(mockGarden);
          setError('Garten nicht in OpenStreetMap gefunden. Zeige Mock-Daten.');
        }
      } else {
        setError(`Garten mit Nummer "${gardenNumber}" nicht gefunden.`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Fehler bei der Suche. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
          <GardenSearch onSearch={handleSearch} isLoading={isLoading} />
          {error && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-4 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          <div className="lg:col-span-2 flex flex-col min-h-0">
            <GardenMap 
              selectedGarden={selectedGarden} 
              osmGeometry={osmGeometry}
              allGardens={allGardens}
              onGardenClick={handleSearch}
            />
          </div>
          
          <div className="lg:col-span-1 flex-shrink-0 relative z-10">
            <GardenDetails garden={selectedGarden} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
