import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMap, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Garden } from '../types/garden';
import { osmGeometryToLeafletCoords } from '../utils/osm';
import type { OSMWay } from '../utils/osm';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import CookieConsentHint from './CookieConsentHint';

// Google Maps API Key aus Umgebungsvariable
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// SVG-Icon für grüne Marker (Theme-Grün #6B8F2D) mit Kontur und weißem Punkt
// Basierend auf dem originalen Leaflet Marker Design
const createGreenMarkerIcon = (size: number = 25) => {
  const width = size;
  const height = size * 1.64; // Standard Leaflet Marker Proportionen
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <!-- Schatten -->
      <path fill="#000000" fill-opacity="0.3" d="M12.5 40.5c-1.5 0-2.5-1-2.5-2.5v-2.5c0-1.5 1-2.5 2.5-2.5s2.5 1 2.5 2.5v2.5c0 1.5-1 2.5-2.5 2.5z"/>
      <!-- Marker Form (Tropfenform) -->
      <path fill="#6B8F2D" stroke="#5A7A25" stroke-width="1.5" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.5 12.5 28.5 12.5 28.5S25 21 25 12.5C25 5.6 19.4 0 12.5 0z"/>
      <!-- Weißer Punkt in der Mitte -->
      <circle cx="12.5" cy="12.5" r="4.5" fill="#FFFFFF" stroke="#5A7A25" stroke-width="0.8"/>
    </svg>
  `;
  return L.divIcon({
    className: 'custom-green-marker',
    html: svg,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
  });
};

// Grüner Marker für freie Gärten
const GreenIcon = createGreenMarkerIcon(25);

// Hervorgehobener Marker (bei Hover) - etwas größer
const HighlightedIcon = createGreenMarkerIcon(30);

L.Marker.prototype.options.icon = DefaultIcon;

/**
 * Berechnet den optimalen Zoom-Level basierend auf den Bounds und der Karten-Größe
 * Verwendet Leaflet's fitBounds Logik für präzise Berechnung
 */
function calculateOptimalZoom(
  bounds: [[number, number], [number, number]],
  mapWidth: number,
  mapHeight: number,
  padding: number = 50
): number {
  const [[minLat, minLon], [maxLat, maxLon]] = bounds;
  
  // Verfügbarer Platz für die Karte (mit Padding)
  const availableWidth = mapWidth - padding * 2;
  const availableHeight = mapHeight - padding * 2;
  
  // Berechne die benötigte Breite und Höhe in Grad
  const latDiff = maxLat - minLat;
  const lonDiff = maxLon - minLon;
  const centerLat = (minLat + maxLat) / 2;
  
  // Berechne Zoom-Level basierend auf Breite und Höhe
  // Formel: zoom = log2(worldSize / tileSize / scale)
  const worldSize = 256; // Standard Tile-Größe
  
  // Berechne für Breite und Höhe separat
  const latZoom = Math.log2(
    (availableHeight * 360) / (latDiff * worldSize)
  );
  const lonZoom = Math.log2(
    (availableWidth * 360) / (lonDiff * worldSize * Math.cos(centerLat * Math.PI / 180))
  );
  
  // Nimm den kleineren Zoom-Level (damit alles sichtbar ist)
  let optimalZoom = Math.floor(Math.min(latZoom, lonZoom));
  
  // Begrenze auf gültigen Bereich
  optimalZoom = Math.max(10, Math.min(22, optimalZoom));
  
  return optimalZoom;
}

interface MapControllerProps {
  garden: Garden | null;
  osmGeometry?: Array<{ lat: number; lon: number }>;
}

function MapController({ garden, osmGeometry }: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (garden && garden.bounds) {
      const [[minLat, minLon], [maxLat, maxLon]] = garden.bounds;
      
      // Berechne optimalen Zoom-Level basierend auf Karten-Größe
      const mapSize = map.getSize();
      const optimalZoom = calculateOptimalZoom(
        [[minLat, minLon], [maxLat, maxLon]],
        mapSize.x,
        mapSize.y,
        150
      );
      
      // Verwende den optimalen Zoom-Level (damit das ganze Grundstück sichtbar ist)
      const finalZoom = optimalZoom;
      
      // Berechne Zentrum
      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;
      
      // Setze View mit optimalem Zoom
      map.setView([centerLat, centerLon], finalZoom);
    } else if (garden && garden.coordinates) {
      map.setView(garden.coordinates, 18);
    }
  }, [garden, osmGeometry, map]);

  return null;
}

// Komponente zum Überwachen des Zoom-Levels
function ZoomWatcher({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

// Komponente zum Aktualisieren der Karten-Größe
function MapSizeUpdater() {
  const map = useMap();

  useEffect(() => {
    // Aktualisiere die Größe nach einem kurzen Delay, damit der Container gerendert ist
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

interface GardenPolygonProps {
  garden: OSMWay;
  isSelected: boolean;
  showLabels: boolean;
  onGardenClick: (gardenNumber: string) => void;
  mapType: 'osm' | 'satellite';
  isAvailable?: boolean; // Ist der Garten ein freier Garten?
  hoveredGardenNumber?: string | null;
  onGardenHover?: (gardenNumber: string | null) => void;
}

function GardenPolygon({ garden, isSelected, showLabels, onGardenClick, mapType, isAvailable = false, hoveredGardenNumber, onGardenHover }: GardenPolygonProps) {
  if (!garden.geometry || garden.geometry.length === 0) return null;

  const coords = osmGeometryToLeafletCoords(garden.geometry);
  const gardenNumber = garden.tags.name || '';
  const isHovered = hoveredGardenNumber === gardenNumber;

  const handleClick = () => {
    if (gardenNumber) {
      onGardenClick(gardenNumber);
    }
  };

  // In Satellitenansicht: Nur Kontur, keine Füllung
  const fillOpacity = mapType === 'satellite' ? 0 : (isSelected ? 0.3 : 0.1);

  return (
    <Polygon
      key={garden.id}
      positions={coords}
      pathOptions={{
        color: isSelected ? '#22c55e' : '#6b7280',
        fillColor: isSelected ? '#22c55e' : '#9ca3af',
        fillOpacity: fillOpacity,
        weight: isSelected ? 2 : 1,
      }}
      eventHandlers={{
        click: handleClick,
        mouseover: () => onGardenHover?.(gardenNumber),
        mouseout: () => onGardenHover?.(null),
      }}
    >
      {gardenNumber && showLabels && (
        <Tooltip
          permanent
          direction="center"
          className={`garden-label-tooltip garden-label-clickable ${isAvailable ? 'garden-label-available' : ''}`}
          opacity={1}
        >
          <span 
            className={`font-semibold cursor-pointer transition-all ${
              isAvailable 
                ? isHovered 
                  ? 'text-white bg-scholle-green-dark text-lg px-2 py-1 rounded' 
                  : 'text-white bg-scholle-green hover:bg-scholle-green-dark hover:text-lg px-2 py-1 rounded'
                : isSelected 
                  ? 'text-scholle-green-dark' 
                  : 'text-scholle-text hover:text-scholle-green'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            onMouseEnter={() => onGardenHover?.(gardenNumber)}
            onMouseLeave={() => onGardenHover?.(null)}
          >
            {gardenNumber}
          </span>
        </Tooltip>
      )}
    </Polygon>
  );
}

interface CookiePreferences {
  googleMaps: boolean;
  openStreetMap: boolean;
}

interface GardenMapProps {
  selectedGarden: Garden | null;
  osmGeometry?: Array<{ lat: number; lon: number }>;
  allGardens: OSMWay[];
  availableGardens?: Garden[]; // Freie Gärten aus der Datenbank
  hoveredGardenNumber?: string | null;
  onGardenHover?: (gardenNumber: string | null) => void;
  onGardenClick: (gardenNumber: string) => void;
  defaultMapType?: 'osm' | '3d';
  cookiePreferences: CookiePreferences;
  onOpenCookieConsent?: () => void;
  disable3D?: boolean;
}

export default function GardenMap({ selectedGarden, osmGeometry, allGardens, availableGardens = [], hoveredGardenNumber, onGardenHover, onGardenClick, defaultMapType = 'osm', cookiePreferences, onOpenCookieConsent, disable3D = false }: GardenMapProps) {
  // Initiale Koordinaten für "Deutsche Scholle Osnabrück"
  const initialCenter: [number, number] = [52.2568, 8.02725];
  const initialZoom = 15;
  
  // Begrenze Kartenansicht auf Region Osnabrück (Stadtlevel)
  const osnabrueckBounds = {
    north: 52.35,  // ~10km nördlich
    south: 52.15,  // ~10km südlich
    east: 8.15,    // ~10km östlich
    west: 7.9,     // ~10km westlich
  };
  
  // Zoom-Level für Label-Anzeige (nur bei hohem Zoom und wenn kein Garten ausgewählt ist)
  const MIN_ZOOM_FOR_LABELS = 17;
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
  const [mapType, setMapType] = useState<'osm' | 'satellite' | '3d'>(defaultMapType || 'osm');
  const showLabels = currentZoom >= MIN_ZOOM_FOR_LABELS && !selectedGarden;

  // Wechsle automatisch zur OSM-Ansicht wenn 3D deaktiviert ist
  useEffect(() => {
    if (disable3D && mapType === '3d') {
      setMapType('osm');
    }
  }, [disable3D, mapType]);
  const googleMap3DRef = useRef<HTMLDivElement | null>(null);
  const googleMapInstanceRef = useRef<any>(null);
  const googleMapPolygonRef = useRef<any>(null);
  const googleMapsScriptLoadedRef = useRef<boolean>(false);
  const mapWrapperRef = useRef<HTMLDivElement>(null);

  // Stelle sicher, dass die Karte die volle Höhe des Parents nutzt
  useEffect(() => {
    const updateHeight = () => {
      if (mapWrapperRef.current && mapWrapperRef.current.parentElement) {
        const parentHeight = mapWrapperRef.current.parentElement.clientHeight;
        if (parentHeight > 350) {
          mapWrapperRef.current.style.height = `${parentHeight}px`;
        }
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Google Maps 3D Integration
  useEffect(() => {
    if (mapType !== '3d' || !googleMap3DRef.current) {
      // Cleanup wenn nicht mehr im 3D-Modus
      if (googleMapPolygonRef.current) {
        googleMapPolygonRef.current.setMap(null);
        googleMapPolygonRef.current = null;
      }
      if (googleMapInstanceRef.current) {
        googleMapInstanceRef.current = null;
      }
      return;
    }

    // Prüfe ob beide Zustimmungen gegeben sind
    if (!cookiePreferences.googleMaps || !cookiePreferences.openStreetMap) {
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.error('Google Maps API Key nicht gefunden');
      return;
    }

    // Warte auf OSM-Daten bevor 3D initialisiert wird
    // Wenn ein Garten ausgewählt ist, warte auf osmGeometry
    // Wenn kein Garten ausgewählt ist (Übersicht), warte auf allGardens
    if (selectedGarden && !osmGeometry) {
      // Warte auf osmGeometry für ausgewählten Garten
      return;
    }
    
    if (!selectedGarden && allGardens.length === 0 && cookiePreferences.openStreetMap) {
      // Warte auf allGardens für Übersicht (nur wenn OSM-Zustimmung gegeben)
      return;
    }

    const initGoogleMaps3D = () => {
      if (!googleMap3DRef.current || !(window as any).google) {
        return;
      }

      const google = (window as any).google;

      // Hilfsfunktion zur Validierung von Koordinaten
      const isValidCoordinate = (lat: number, lon: number): boolean => {
        return typeof lat === 'number' && typeof lon === 'number' && 
               !isNaN(lat) && !isNaN(lon) && 
               lat >= -90 && lat <= 90 && 
               lon >= -180 && lon <= 180;
      };

      // Berechne Bounds für alle Gärten oder nur den ausgewählten
      const bounds = new google.maps.LatLngBounds();
      let hasValidBounds = false;

      if (selectedGarden && osmGeometry && osmGeometry.length > 0) {
        // Verwende ausgewählten Garten mit osmGeometry
        for (const point of osmGeometry) {
          if (isValidCoordinate(point.lat, point.lon)) {
            bounds.extend(new google.maps.LatLng(point.lat, point.lon));
            hasValidBounds = true;
          }
        }
      } else if (allGardens.length > 0) {
        // Verwende alle Gärten für die Übersicht
        for (const garden of allGardens) {
          if (garden.geometry && garden.geometry.length > 0) {
            for (const point of garden.geometry) {
              if (isValidCoordinate(point.lat, point.lon)) {
                bounds.extend(new google.maps.LatLng(point.lat, point.lon));
                hasValidBounds = true;
              }
            }
          }
        }
      }
      
      // Fallback auf initiale Koordinaten wenn keine gültigen Bounds vorhanden
      if (!hasValidBounds) {
        bounds.extend(new google.maps.LatLng(initialCenter[0], initialCenter[1]));
      }

      // Erstelle Google Maps mit 3D-Features
      const map = new google.maps.Map(googleMap3DRef.current, {
        center: bounds.isEmpty() ? { lat: initialCenter[0], lng: initialCenter[1] } : bounds.getCenter(),
        zoom: selectedGarden ? 18 : 15,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        tilt: 45, // Neige die Kamera für 3D-Ansicht
        heading: 0,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        // Begrenze Kartenansicht auf Region Osnabrück (Stadtlevel)
        restriction: {
          latLngBounds: new google.maps.LatLngBounds(
            { lat: osnabrueckBounds.south, lng: osnabrueckBounds.west },
            { lat: osnabrueckBounds.north, lng: osnabrueckBounds.east }
          ),
          strictBounds: true, // Verhindert Rauszoomen über die Grenzen hinaus
        },
        // Setze maximale Zoom-Stufe (Google Maps unterstützt bis zu 22-23 für Satellitenbilder)
        maxZoom: 23,
        minZoom: 12, // Höhere minimale Zoom-Stufe, damit man nicht zu weit rauszoomt
      });

      googleMapInstanceRef.current = map;

      // Zeige alle Gärten an
      for (const garden of allGardens) {
        if (garden.geometry && garden.geometry.length > 0) {
          // Validiere alle Koordinaten bevor Polygon erstellt wird
          const validPath = garden.geometry
            .filter((point: { lat: number; lon: number }) => isValidCoordinate(point.lat, point.lon))
            .map((point: { lat: number; lon: number }) =>
              new google.maps.LatLng(point.lat, point.lon)
            );

          // Überspringe wenn keine gültigen Koordinaten vorhanden
          if (validPath.length < 3) {
            continue;
          }

          const isSelected = selectedGarden && garden.tags?.ref === selectedGarden.number;

          const polygon = new google.maps.Polygon({
            paths: validPath,
            strokeColor: isSelected ? '#00FF00' : '#888888',
            strokeOpacity: isSelected ? 1.0 : 0.5,
            strokeWeight: isSelected ? 3 : 1,
            fillColor: isSelected ? '#00FF00' : '#888888',
            fillOpacity: 0, // Kein transparenter Hintergrund
            map: map,
          });

          // Mache Polygon klickbar
          polygon.addListener('click', () => {
            if (garden.tags?.ref) {
              onGardenClick(garden.tags.ref);
            }
          });
        }
      }

      // Zeige ausgewählten Garten hervorgehoben
      if (selectedGarden && osmGeometry && osmGeometry.length > 0) {
        // Validiere alle Koordinaten bevor Polygon erstellt wird
        const validSelectedPath = osmGeometry
          .filter(point => isValidCoordinate(point.lat, point.lon))
          .map(point => new google.maps.LatLng(point.lat, point.lon));

        if (validSelectedPath.length >= 3) {
          const selectedPolygon = new google.maps.Polygon({
            paths: validSelectedPath,
            strokeColor: '#00FF00',
            strokeOpacity: 1.0,
            strokeWeight: 3,
            fillColor: '#00FF00',
            fillOpacity: 0, // Kein transparenter Hintergrund
            map: map,
          });

          googleMapPolygonRef.current = selectedPolygon;

          // Zoome zum ausgewählten Garten - warte kurz damit die Karte gerendert ist
          setTimeout(() => {
            try {
              const selectedBounds = new google.maps.LatLngBounds();
              validSelectedPath.forEach((p: any) => selectedBounds.extend(p));
              if (!selectedBounds.isEmpty()) {
                map.fitBounds(selectedBounds);
              }
            } catch (error) {
              console.error('Error fitting bounds for selected garden:', error);
            }
          }, 100);
        }
      } else if (hasValidBounds && !bounds.isEmpty()) {
        // Warte kurz damit die Karte gerendert ist bevor bounds gesetzt werden
        setTimeout(() => {
          try {
            map.fitBounds(bounds);
          } catch (error) {
            console.error('Error fitting bounds:', error);
          }
        }, 100);
      }

      // Stelle sicher, dass 3D aktiviert ist
      google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
        map.setTilt(45);
      });
    };

    // Lade Google Maps API Script falls noch nicht geladen
    // Prüfe ob Script bereits im DOM existiert
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    
    if (!googleMapsScriptLoadedRef.current && !(window as any).google && !existingScript) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        googleMapsScriptLoadedRef.current = true;
        initGoogleMaps3D();
      };
      script.onerror = () => {
        console.error('Failed to load Google Maps API');
      };
      document.head.appendChild(script);
    } else if ((window as any).google) {
      // Google Maps bereits geladen, initialisiere direkt
      googleMapsScriptLoadedRef.current = true;
      initGoogleMaps3D();
    } else if (existingScript) {
      // Script existiert bereits, warte auf Laden
      const checkGoogle = setInterval(() => {
        if ((window as any).google) {
          googleMapsScriptLoadedRef.current = true;
          clearInterval(checkGoogle);
          initGoogleMaps3D();
        }
      }, 100);
      
      // Timeout nach 5 Sekunden
      setTimeout(() => {
        clearInterval(checkGoogle);
      }, 5000);
    }

    // Cleanup
    return () => {
      if (googleMapPolygonRef.current) {
        googleMapPolygonRef.current.setMap(null);
        googleMapPolygonRef.current = null;
      }
    };
  }, [mapType, selectedGarden, osmGeometry, allGardens, onGardenClick, cookiePreferences.googleMaps, cookiePreferences.openStreetMap]);

  return (
    <div ref={mapWrapperRef} className="w-full flex-1 min-h-[350px] flex flex-col rounded-lg overflow-hidden border border-scholle-border relative">
      {/* Map Type Toggle - Nur anzeigen wenn Umschalten möglich ist */}
      {!disable3D && (
        <div className="absolute top-2 right-2 z-[1001] bg-scholle-bg-container rounded-lg shadow-lg p-1 flex gap-1 border border-scholle-border">
          <button
            onClick={() => setMapType('osm')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              mapType === 'osm'
                ? 'bg-scholle-green text-white'
                : 'bg-scholle-bg-light text-scholle-text hover:bg-scholle-border'
            }`}
          >
            Karte
          </button>
          <button
            onClick={() => setMapType('3d')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              mapType === '3d'
                ? 'bg-scholle-green text-white'
                : 'bg-scholle-bg-light text-scholle-text hover:bg-scholle-border'
            }`}
          >
            Luftbild (3D)
          </button>
        </div>
      )}

      {/* Google Maps 3D Ansicht */}
      {mapType === '3d' ? (
        <>
          {cookiePreferences.googleMaps && cookiePreferences.openStreetMap ? (
            <div ref={googleMap3DRef} className="w-full h-full" />
          ) : (
            <CookieConsentHint 
              services={['OpenStreetMap', 'Google Maps']}
              feature="die 3D-Luftbildansicht"
              onOpenCookieConsent={onOpenCookieConsent}
            />
          )}
        </>
      ) : (
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%', minHeight: '350px', flex: '1 1 0%' }}
        scrollWheelZoom={true}
        maxZoom={mapType === 'satellite' ? 22 : 19}
        minZoom={10}
        key={`map-${mapType}`}
      >
        {mapType === 'osm' ? (
          cookiePreferences.openStreetMap ? (
            <TileLayer
              key="osm"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          ) : (
            <CookieConsentHint 
              service="OpenStreetMap" 
              feature="die Kartenansicht"
              onOpenCookieConsent={onOpenCookieConsent}
            />
          )
        ) : (
          <>
            {/* Google Maps Satellite - Höchste Qualität */}
            {GOOGLE_MAPS_API_KEY ? (
              <TileLayer
                key="satellite-google"
                attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                url={`https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_API_KEY}`}
                maxZoom={22}
                minZoom={0}
                tileSize={256}
                zoomOffset={0}
                maxNativeZoom={22}
                subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
              />
            ) : (
              <>
                {/* Fallback: Esri falls Google Maps API Key nicht gesetzt */}
                <TileLayer
                  key="satellite-esri"
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a> &copy; <a href="https://www.maxar.com/">Maxar</a>'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={23}
                  minZoom={10}
                  tileSize={256}
                  zoomOffset={0}
                  maxNativeZoom={19}
                />
                {!GOOGLE_MAPS_API_KEY && (
                  <div className="absolute top-12 right-2 z-[1000] bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800 max-w-xs">
                    ⚠ Google Maps API Key nicht gefunden. Bitte setzen Sie VITE_GOOGLE_MAPS_API_KEY in der .env Datei.
                  </div>
                )}
              </>
            )}
          </>
        )}
        <MapController garden={selectedGarden} osmGeometry={osmGeometry} />
        <ZoomWatcher onZoomChange={setCurrentZoom} />
        <MapSizeUpdater />
        
        {/* Zeige alle Gärten an */}
        {allGardens.map((garden) => {
          const isSelected = !!(selectedGarden && selectedGarden.number === garden.tags.name);
          // Prüfe ob der Garten ein freier Garten ist
          const isAvailable = availableGardens.some(g => g.number === garden.tags.name);
          return (
            <GardenPolygon
              key={garden.id}
              garden={garden}
              isSelected={isSelected}
              showLabels={showLabels}
              onGardenClick={onGardenClick}
              mapType={mapType}
              isAvailable={isAvailable}
              hoveredGardenNumber={hoveredGardenNumber}
              onGardenHover={onGardenHover}
            />
          );
        })}
        
        {/* Zeige ausgewählten Garten als Polygon wenn osmGeometry vorhanden ist (auch wenn nicht in allGardens) */}
        {selectedGarden && osmGeometry && osmGeometry.length > 0 && (() => {
          const gardenNumber = selectedGarden.number;
          const isSatellite = mapType === 'satellite';
          return (
            <Polygon
              positions={osmGeometryToLeafletCoords(osmGeometry)}
              pathOptions={{
                color: '#22c55e',
                fillColor: '#22c55e',
                fillOpacity: isSatellite ? 0 : 0.3,
                weight: 2,
              }}
              eventHandlers={{
                click: () => onGardenClick(gardenNumber),
              }}
            >
              {showLabels && (
                <Tooltip
                  permanent
                  direction="center"
                  className="garden-label-tooltip garden-label-clickable"
                  opacity={1}
                >
                  <span 
                    className="font-semibold cursor-pointer hover:underline text-scholle-green-dark"
                    onClick={(e) => {
                      e.stopPropagation();
                      onGardenClick(gardenNumber);
                    }}
                  >
                    {gardenNumber}
                  </span>
                </Tooltip>
              )}
            </Polygon>
          );
        })()}
        
        {/* Marker nur in Kartenansicht, nicht in Satellitenansicht */}
        {selectedGarden && selectedGarden.coordinates && mapType === 'osm' && (
          <Marker position={selectedGarden.coordinates} />
        )}
        
        {/* Marker für freie Gärten - nur wenn in OSM gefunden und Labels NICHT sichtbar */}
        {mapType === 'osm' && !showLabels && availableGardens.map((garden) => {
          // Prüfe ob der Garten in OSM gefunden wurde (nur nach Name suchen)
          const osmGarden = allGardens.find(
            osm => osm.tags.name === garden.number
          );
          
          // Nur anzeigen wenn in OSM gefunden und Geometrie vorhanden
          if (!osmGarden || !osmGarden.geometry || osmGarden.geometry.length === 0) {
            return null;
          }
          
          // Berechne Zentrum der Geometrie
          const centerLat = osmGarden.geometry.reduce((sum, p) => sum + p.lat, 0) / osmGarden.geometry.length;
          const centerLon = osmGarden.geometry.reduce((sum, p) => sum + p.lon, 0) / osmGarden.geometry.length;
          
          const isHovered = hoveredGardenNumber === garden.number;
          
          return (
            <Marker
              key={`available-${garden.id}`}
              position={[centerLat, centerLon]}
              icon={isHovered ? HighlightedIcon : GreenIcon}
              eventHandlers={{
                click: () => onGardenClick(garden.number),
                mouseover: () => onGardenHover?.(garden.number),
                mouseout: () => onGardenHover?.(null),
              }}
            >
              <Tooltip permanent={false}>
                Garten {garden.number}
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
      )}
    </div>
  );
}

