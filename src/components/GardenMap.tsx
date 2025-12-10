import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import type { CookiePreferences } from "../types/cookies";
import type { Garden } from "../types/garden";
import {
  GOOGLE_MAPS_CONFIG,
  INITIAL_MAP_CENTER,
  INITIAL_MAP_ZOOM,
  MIN_ZOOM_FOR_LABELS,
  OSNABRUECK_BOUNDS,
} from "../utils/constants";
import {
  applyBoundsPadding,
  calculateGardensBounds,
  calculateGeometryCenter,
  isValidCoordinate,
} from "../utils/mapHelpers";
import type { OSMWay } from "../utils/osm";
import { osmGeometryToLeafletCoords } from "../utils/osm";
import CookieConsentHint from "./CookieConsentHint";

// Google Maps API Key aus Umgebungsvariable
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

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
    className: "custom-green-marker",
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

interface MapControllerProps {
  garden: Garden | null;
  osmGeometry?: Array<{ lat: number; lon: number }>;
}

function MapController({ garden, osmGeometry }: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    // Warte kurz, damit die Karte ihre Größe bestimmen kann
    // React-Leaflet braucht Zeit für initiales Rendering, sonst sind getSize() Werte falsch
    const timer = setTimeout(() => {
      if (!garden) return;

      // Priorität 1: Verwende osmGeometry wenn verfügbar (präziseste Darstellung)
      if (osmGeometry && osmGeometry.length > 0) {
        // Validiere alle Koordinaten
        const validPoints = osmGeometry.filter((point) => isValidCoordinate(point.lat, point.lon));

        if (validPoints.length >= 3) {
          // Berechne Bounds aus dem Polygon
          const lats = validPoints.map((p) => p.lat);
          const lons = validPoints.map((p) => p.lon);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLon = Math.min(...lons);
          const maxLon = Math.max(...lons);

          // Verwende fitBounds für optimales Zoomen und Zentrieren
          // Padding sorgt dafür, dass der Garten nicht am Rand klebt
          const bounds: [[number, number], [number, number]] = [
            [minLat, minLon],
            [maxLat, maxLon],
          ];

          map.fitBounds(bounds, {
            padding: [50, 50], // Padding in Pixeln
            maxZoom: 20, // Maximaler Zoom-Level für Detailansicht
          });
          return;
        }
      }

      // Priorität 2: Verwende garden.bounds wenn verfügbar
      if (garden.bounds) {
        const [[minLat, minLon], [maxLat, maxLon]] = garden.bounds;

        // Verwende fitBounds für optimales Zoomen und Zentrieren
        const bounds: [[number, number], [number, number]] = [
          [minLat, minLon],
          [maxLat, maxLon],
        ];

        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 20,
        });
        return;
      }

      // Priorität 3: Fallback auf Koordinaten mit festem Zoom-Level
      if (garden.coordinates) {
        map.setView(garden.coordinates, GOOGLE_MAPS_CONFIG.GARDEN_ZOOM);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [garden, osmGeometry, map]);

  return null;
}

interface AllGardensMapControllerProps {
  allGardens: OSMWay[];
}

/**
 * Controller für die Startseite: Berechnet Bounds aller Gärten und zoomt/zentriert die Karte entsprechend
 *
 * Warum ein separater Controller?
 * - React-Leaflet erfordert, dass Map-Operationen innerhalb von useMap() Hook ausgeführt werden
 * - Trennung der Logik für bessere Wartbarkeit
 */
function AllGardensMapController({ allGardens }: AllGardensMapControllerProps) {
  const map = useMap();
  const lastGardensCountRef = useRef(0);

  useEffect(() => {
    // Nur aktualisieren wenn Gärten vorhanden sind
    if (allGardens.length === 0) {
      return;
    }

    // Warte kurz, damit die Karte ihre Größe bestimmen kann
    // React-Leaflet braucht Zeit für initiales Rendering, sonst sind getSize() Werte falsch
    const timer = setTimeout(() => {
      const { minLat, maxLat, minLon, maxLon, hasValidBounds } = calculateGardensBounds(allGardens);

      if (hasValidBounds) {
        // Padding hinzufügen, damit Gärten nicht am Rand kleben
        const bounds = applyBoundsPadding(minLat, maxLat, minLon, maxLon, 0.1);
        map.fitBounds(bounds, {
          padding: [50, 50],
        });

        lastGardensCountRef.current = allGardens.length;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [allGardens, map]);

  return null;
}

/**
 * Komponente zum Überwachen des Zoom-Levels
 *
 * Warum notwendig?
 * - Labels werden nur bei hohem Zoom angezeigt (Performance-Optimierung)
 * - React-Leaflet bietet keinen direkten State für Zoom-Level
 */
function ZoomWatcher({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  // Initialen Zoom-Level setzen (falls Karte bereits geladen ist)
  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

/**
 * Komponente zum Aktualisieren der Karten-Größe
 *
 * Warum notwendig?
 * - Leaflet berechnet Karten-Größe beim initialen Rendering
 * - Bei dynamischen Layouts (z.B. Resize, Tab-Wechsel) muss Größe neu berechnet werden
 * - Delay gibt Browser Zeit für Layout-Berechnung
 */
function MapSizeUpdater() {
  const map = useMap();

  useEffect(() => {
    // Aktualisiere die Größe nach einem kurzen Delay, damit der Container gerendert ist
    // React braucht Zeit für Layout-Berechnung, sonst ist clientHeight noch 0
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
  mapType: "osm" | "satellite";
  isAvailable?: boolean; // Ist der Garten ein freier Garten?
  hoveredGardenNumber?: string | null;
  onGardenHover?: (gardenNumber: string | null) => void;
}

function GardenPolygon({
  garden,
  isSelected,
  showLabels,
  onGardenClick,
  mapType,
  isAvailable = false,
  hoveredGardenNumber,
  onGardenHover,
}: GardenPolygonProps) {
  if (!garden.geometry || garden.geometry.length === 0) return null;

  const coords = osmGeometryToLeafletCoords(garden.geometry);
  const gardenNumber = garden.tags.ref || ""; // ref ist das Standard-Tag für Gartennummern
  const isHovered = hoveredGardenNumber === gardenNumber;

  const handleClick = () => {
    // In Satellitenansicht keine Klicks erlauben
    if (mapType === "satellite") return;
    if (gardenNumber) {
      onGardenClick(gardenNumber);
    }
  };

  // In Satellitenansicht: Nur Kontur, keine Füllung
  const fillOpacity = mapType === "satellite" ? 0 : isSelected ? 0.3 : 0.1;
  const isClickable = mapType !== "satellite";

  return (
    <Polygon
      key={garden.id}
      positions={coords}
      pathOptions={{
        color: isSelected ? "#22c55e" : "#6b7280",
        fillColor: isSelected ? "#22c55e" : "#9ca3af",
        fillOpacity: fillOpacity,
        weight: isSelected ? 2 : 1,
      }}
      eventHandlers={
        isClickable
          ? {
              click: handleClick,
              mouseover: () => onGardenHover?.(gardenNumber),
              mouseout: () => onGardenHover?.(null),
            }
          : {}
      }
    >
      {gardenNumber && showLabels && (
        <Tooltip
          permanent
          direction="center"
          className={`garden-label-tooltip garden-label-clickable ${isAvailable ? "garden-label-available" : ""}`}
          opacity={1}
        >
          <span
            className={`font-semibold transition-all ${
              isClickable ? "cursor-pointer" : "cursor-default"
            } ${
              isAvailable
                ? isHovered
                  ? "text-white bg-scholle-green-dark text-lg px-2 py-1 rounded-sm"
                  : "text-white bg-scholle-green hover:bg-scholle-green-dark hover:text-lg px-2 py-1 rounded-sm"
                : isSelected
                  ? "text-scholle-green-dark"
                  : "text-scholle-text hover:text-scholle-green"
            }`}
            onClick={
              isClickable
                ? (e) => {
                    e.stopPropagation();
                    handleClick();
                  }
                : undefined
            }
            onMouseEnter={isClickable ? () => onGardenHover?.(gardenNumber) : undefined}
            onMouseLeave={isClickable ? () => onGardenHover?.(null) : undefined}
          >
            {gardenNumber}
          </span>
        </Tooltip>
      )}
    </Polygon>
  );
}

interface GardenMapProps {
  selectedGarden: Garden | null;
  osmGeometry?: Array<{ lat: number; lon: number }>;
  allGardens: OSMWay[];
  availableGardens?: Garden[]; // Freie Gärten aus der Datenbank
  hoveredGardenNumber?: string | null;
  onGardenHover?: (gardenNumber: string | null) => void;
  onGardenClick: (gardenNumber: string) => void;
  defaultMapType?: "osm" | "3d";
  cookiePreferences: CookiePreferences;
  onOpenCookieConsent?: () => void;
  disable3D?: boolean;
}

export default function GardenMap({
  selectedGarden,
  osmGeometry,
  allGardens,
  availableGardens = [],
  hoveredGardenNumber,
  onGardenHover,
  onGardenClick,
  defaultMapType = "osm",
  cookiePreferences,
  onOpenCookieConsent,
  disable3D = false,
}: GardenMapProps) {
  const [currentZoom, setCurrentZoom] = useState(INITIAL_MAP_ZOOM);
  const [mapType, setMapType] = useState<"osm" | "satellite" | "3d">(defaultMapType || "osm");

  // Zeige Labels in OSM-Ansicht wenn Zoom hoch genug ist (auch auf Detailseite)
  const showLabels = currentZoom >= MIN_ZOOM_FOR_LABELS && mapType === "osm";

  // Leaflet Bounds für maxBounds (using tighter bounds for map view)
  const osnabrueckLeafletBounds: [[number, number], [number, number]] = [
    [52.25, 8.0],
    [52.27, 8.05],
  ];

  // Memoize available garden numbers for faster lookups
  // Set verwendet für O(1) Lookup-Performance statt O(n) mit Array.some()
  const availableGardenNumbers = useMemo(
    () => new Set(availableGardens.map((g) => g.number)),
    [availableGardens]
  );

  // Memoize OSM garden map for faster lookups
  // Map verwendet für O(1) Lookup-Performance statt O(n) mit Array.find()
  const osmGardenMap = useMemo(
    () => new Map(allGardens.map((g) => [g.tags.ref || "", g])),
    [allGardens]
  );

  // Memoize garden polygons (only render when not in 3D mode)
  // Verhindert unnötige Neuberechnung bei jedem Render (Performance-Optimierung)
  const gardenPolygons = useMemo(() => {
    if (mapType === "3d") return []; // In 3D-Modus werden Polygone nicht gerendert

    const effectiveMapType = mapType === "satellite" ? "satellite" : "osm";
    return allGardens.map((garden) => {
      const gardenRef = garden.tags.ref || "";
      const isSelected = !!(selectedGarden && selectedGarden.number === gardenRef);
      const isAvailable = availableGardenNumbers.has(gardenRef);
      return (
        <GardenPolygon
          key={garden.id}
          garden={garden}
          isSelected={isSelected}
          showLabels={showLabels}
          onGardenClick={onGardenClick}
          mapType={effectiveMapType}
          isAvailable={isAvailable}
          hoveredGardenNumber={hoveredGardenNumber}
          onGardenHover={onGardenHover}
        />
      );
    });
  }, [
    allGardens,
    availableGardenNumbers,
    selectedGarden,
    showLabels,
    mapType,
    hoveredGardenNumber,
    onGardenClick,
    onGardenHover,
  ]);

  // Memoize available garden markers
  // Verhindert unnötige Neuberechnung bei jedem Render (Performance-Optimierung)
  // Markers werden nur angezeigt wenn Labels nicht sichtbar sind (sonst redundant)
  const availableMarkers = useMemo(() => {
    if (mapType !== "osm" || showLabels) return [];

    return availableGardens
      .map((garden) => {
        const osmGarden = osmGardenMap.get(garden.number);

        // Nur anzeigen wenn in OSM gefunden und Geometrie vorhanden
        if (!osmGarden || !osmGarden.geometry || osmGarden.geometry.length === 0) {
          return null;
        }

        // Berechne Zentrum der Geometrie
        const center = calculateGeometryCenter(osmGarden.geometry);
        if (!center) return null;

        const isHovered = hoveredGardenNumber === garden.number;

        return (
          <Marker
            key={`available-${garden.id}`}
            position={[center.lat, center.lon]}
            icon={isHovered ? HighlightedIcon : GreenIcon}
            eventHandlers={{
              click: () => onGardenClick(garden.number),
              mouseover: () => onGardenHover?.(garden.number),
              mouseout: () => onGardenHover?.(null),
            }}
          >
            <Tooltip permanent={false}>Garten {garden.number}</Tooltip>
          </Marker>
        );
      })
      .filter(Boolean);
  }, [
    mapType,
    showLabels,
    availableGardens,
    osmGardenMap,
    hoveredGardenNumber,
    onGardenClick,
    onGardenHover,
  ]);

  // Wechsle automatisch zur OSM-Ansicht wenn 3D deaktiviert ist
  useEffect(() => {
    if (disable3D && mapType === "3d") {
      setMapType("osm");
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
      if (mapWrapperRef.current?.parentElement) {
        const parentHeight = mapWrapperRef.current.parentElement.clientHeight;
        if (parentHeight > 350) {
          mapWrapperRef.current.style.height = `${parentHeight}px`;
        }
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  // Google Maps 3D Integration
  useEffect(() => {
    if (mapType !== "3d" || !googleMap3DRef.current) {
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
      console.error("Google Maps API Key nicht gefunden");
      return;
    }

    // Warte auf OSM-Daten bevor 3D initialisiert wird
    // Warum?
    // - Google Maps 3D benötigt Koordinaten für Bounds-Berechnung
    // - Ohne Daten würde Karte auf Standard-Position zentrieren (schlechte UX)
    // - Verhindert unnötige API-Calls wenn Daten noch nicht verfügbar sind
    if (selectedGarden && !osmGeometry) {
      // Warte auf osmGeometry für ausgewählten Garten
      return;
    }

    if (!selectedGarden && allGardens.length === 0 && cookiePreferences.openStreetMap) {
      // Warte auf allGardens für Übersicht (nur wenn OSM-Zustimmung gegeben)
      // Ohne Gärten kann keine sinnvolle Bounds-Berechnung erfolgen
      return;
    }

    const initGoogleMaps3D = () => {
      if (!googleMap3DRef.current || !(window as any).google) {
        return;
      }

      const google = (window as any).google;

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
        bounds.extend(new google.maps.LatLng(INITIAL_MAP_CENTER[0], INITIAL_MAP_CENTER[1]));
      }

      // Erstelle Google Maps mit 3D-Features
      const map = new google.maps.Map(googleMap3DRef.current, {
        center: bounds.isEmpty()
          ? { lat: INITIAL_MAP_CENTER[0], lng: INITIAL_MAP_CENTER[1] }
          : bounds.getCenter(),
        zoom: selectedGarden ? GOOGLE_MAPS_CONFIG.GARDEN_ZOOM : GOOGLE_MAPS_CONFIG.DEFAULT_ZOOM,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        tilt: GOOGLE_MAPS_CONFIG.TILT,
        heading: 0,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.TOP_LEFT, // Gleiche Position wie OSM-Karte
        },
        // Begrenze Kartenansicht auf Region Osnabrück (Stadtlevel)
        restriction: {
          latLngBounds: new google.maps.LatLngBounds(
            { lat: OSNABRUECK_BOUNDS.south, lng: OSNABRUECK_BOUNDS.west },
            { lat: OSNABRUECK_BOUNDS.north, lng: OSNABRUECK_BOUNDS.east }
          ),
          strictBounds: true, // Verhindert Rauszoomen über die Grenzen hinaus
        },
        maxZoom: GOOGLE_MAPS_CONFIG.MAX_ZOOM,
        minZoom: GOOGLE_MAPS_CONFIG.MIN_ZOOM,
      });

      googleMapInstanceRef.current = map;

      // Zeige alle Gärten an
      for (const garden of allGardens) {
        if (garden.geometry && garden.geometry.length > 0) {
          // Validiere alle Koordinaten bevor Polygon erstellt wird
          // Warum?
          // - Ungültige Koordinaten würden Google Maps API zum Absturz bringen
          // - Filterung verhindert Fehler und verbessert Performance
          const validPath = garden.geometry
            .filter((point: { lat: number; lon: number }) =>
              isValidCoordinate(point.lat, point.lon)
            )
            .map(
              (point: { lat: number; lon: number }) => new google.maps.LatLng(point.lat, point.lon)
            );

          // Überspringe wenn keine gültigen Koordinaten vorhanden
          // Polygon benötigt mindestens 3 Punkte (Dreieck)
          if (validPath.length < 3) {
            continue;
          }

          const isSelected = selectedGarden && garden.tags?.ref === selectedGarden.number;

          // Erstelle Polygon für Visualisierung (nicht klickbar in Luftbildansicht)
          // In Luftbildansicht (3D/Satellit) keine Klicks erlauben
          // Polygone dienen nur zur Visualisierung, nicht zur Navigation
          new google.maps.Polygon({
            paths: validPath,
            strokeColor: isSelected ? "#00FF00" : "#888888",
            strokeOpacity: isSelected ? 1.0 : 0.5,
            strokeWeight: isSelected ? 3 : 1,
            fillColor: isSelected ? "#00FF00" : "#888888",
            fillOpacity: 0, // Kein transparenter Hintergrund
            map: map, // Polygon wird durch map-Property automatisch angezeigt
          });
        }
      }

      // Zeige ausgewählten Garten hervorgehoben
      if (selectedGarden && osmGeometry && osmGeometry.length > 0) {
        // Validiere alle Koordinaten bevor Polygon erstellt wird
        const validSelectedPath = osmGeometry
          .filter((point) => isValidCoordinate(point.lat, point.lon))
          .map((point) => new google.maps.LatLng(point.lat, point.lon));

        if (validSelectedPath.length >= 3) {
          const selectedPolygon = new google.maps.Polygon({
            paths: validSelectedPath,
            strokeColor: "#00FF00",
            strokeOpacity: 1.0,
            strokeWeight: 3,
            fillColor: "#00FF00",
            fillOpacity: 0, // Kein transparenter Hintergrund
            map: map,
          });

          googleMapPolygonRef.current = selectedPolygon;

          // Zoome zum ausgewählten Garten - warte kurz damit die Karte gerendert ist
          // Warum setTimeout?
          // - Google Maps braucht Zeit für initiales Rendering
          // - fitBounds() funktioniert erst nach vollständigem Laden der Karte
          setTimeout(() => {
            try {
              const selectedBounds = new google.maps.LatLngBounds();
              for (const p of validSelectedPath) {
                selectedBounds.extend(p);
              }
              if (!selectedBounds.isEmpty()) {
                map.fitBounds(selectedBounds);
              }
            } catch (error) {
              console.error("Error fitting bounds for selected garden:", error);
            }
          }, 100);
        }
      } else if (hasValidBounds && !bounds.isEmpty()) {
        // Warte kurz damit die Karte gerendert ist bevor bounds gesetzt werden
        setTimeout(() => {
          try {
            map.fitBounds(bounds);
          } catch (error) {
            console.error("Error fitting bounds:", error);
          }
        }, 100);
      }

      // Stelle sicher, dass 3D aktiviert ist
      // Warum tilesloaded Event?
      // - Tilt muss nach vollständigem Laden der Karte gesetzt werden
      // - Sonst wird 3D-Ansicht nicht korrekt aktiviert
      google.maps.event.addListenerOnce(map, "tilesloaded", () => {
        map.setTilt(GOOGLE_MAPS_CONFIG.TILT);
      });
    };

    // Lade Google Maps API Script falls noch nicht geladen
    // Prüfe ob Script bereits im DOM existiert
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');

    // Callback-Funktion für Google Maps API
    const callbackName = "initGoogleMapsCallback";
    (window as any)[callbackName] = () => {
      googleMapsScriptLoadedRef.current = true;
      initGoogleMaps3D();
    };

    // Prüfe ob API bereits vollständig geladen ist (LatLngBounds existiert)
    const isGoogleMapsReady = () => {
      return (window as any).google?.maps?.LatLngBounds;
    };

    if (!googleMapsScriptLoadedRef.current && !isGoogleMapsReady() && !existingScript) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry&loading=async&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.error("Failed to load Google Maps API");
      };
      document.head.appendChild(script);
    } else if (isGoogleMapsReady()) {
      // Google Maps bereits vollständig geladen, initialisiere direkt
      googleMapsScriptLoadedRef.current = true;
      initGoogleMaps3D();
    } else if (existingScript) {
      // Script existiert bereits, warte auf vollständiges Laden
      const checkGoogle = setInterval(() => {
        if (isGoogleMapsReady()) {
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
  }, [
    mapType,
    selectedGarden,
    osmGeometry,
    allGardens,
    cookiePreferences.googleMaps,
    cookiePreferences.openStreetMap,
  ]);

  return (
    <div
      ref={mapWrapperRef}
      className="w-full flex-1 min-h-[350px] flex flex-col rounded-lg overflow-hidden border border-scholle-border relative"
    >
      {/* Map Type Toggle - Nur anzeigen wenn Umschalten möglich ist */}
      {!disable3D && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-1001 bg-scholle-bg-container rounded-lg shadow-lg p-1 flex gap-1 border border-scholle-border">
          <button
            onClick={() => setMapType("osm")}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              mapType === "osm"
                ? "bg-scholle-green text-white"
                : "bg-scholle-bg-light text-scholle-text hover:bg-scholle-border"
            }`}
          >
            Karte
          </button>
          <button
            onClick={() => setMapType("3d")}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              mapType === "3d"
                ? "bg-scholle-green text-white"
                : "bg-scholle-bg-light text-scholle-text hover:bg-scholle-border"
            }`}
          >
            Luftbild (3D)
          </button>
        </div>
      )}

      {/* Google Maps 3D Ansicht */}
      {mapType === "3d" ? (
        cookiePreferences.googleMaps && cookiePreferences.openStreetMap ? (
          <div ref={googleMap3DRef} className="w-full h-full" />
        ) : (
          <CookieConsentHint
            services={["OpenStreetMap", "Google Maps"]}
            feature="die 3D-Luftbildansicht"
            onOpenCookieConsent={onOpenCookieConsent}
          />
        )
      ) : (
        <MapContainer
          center={INITIAL_MAP_CENTER}
          zoom={INITIAL_MAP_ZOOM}
          style={{ height: "100%", width: "100%", minHeight: "350px", flex: "1 1 0%" }}
          scrollWheelZoom={true}
          maxZoom={mapType === "satellite" ? 22 : 19}
          minZoom={13}
          maxBounds={osnabrueckLeafletBounds}
          maxBoundsViscosity={1.0}
          key={`map-${mapType}`}
        >
          {mapType === "osm" ? (
            cookiePreferences.openStreetMap ? (
              <TileLayer
                key="osm"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png"
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
                  subdomains={["mt0", "mt1", "mt2", "mt3"]}
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
                    <div className="absolute top-12 right-2 z-1000 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800 max-w-xs">
                      ⚠ Google Maps API Key nicht gefunden. Bitte setzen Sie
                      VITE_GOOGLE_MAPS_API_KEY in der .env Datei.
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {/* Controller für ausgewählten Garten */}
          {selectedGarden && <MapController garden={selectedGarden} osmGeometry={osmGeometry} />}

          {/* Controller für alle Gärten auf der Startseite */}
          {!selectedGarden && allGardens.length > 0 && (
            <AllGardensMapController allGardens={allGardens} />
          )}

          <ZoomWatcher onZoomChange={setCurrentZoom} />
          <MapSizeUpdater />

          {/* Zeige alle Gärten an, aber nur gefilterte als verfügbar markieren */}
          {gardenPolygons}

          {/* Zeige ausgewählten Garten als Polygon wenn osmGeometry vorhanden ist (auch wenn nicht in allGardens) */}
          {selectedGarden &&
            osmGeometry &&
            osmGeometry.length > 0 &&
            (() => {
              const gardenNumber = selectedGarden.number;
              const isSatellite = mapType === "satellite";
              const isAvailable = availableGardens.some((g) => g.number === gardenNumber);
              const isHovered = hoveredGardenNumber === gardenNumber;
              return (
                <Polygon
                  positions={osmGeometryToLeafletCoords(osmGeometry)}
                  pathOptions={{
                    color: "#22c55e",
                    fillColor: "#22c55e",
                    fillOpacity: isSatellite ? 0 : 0.3,
                    weight: 2,
                  }}
                  eventHandlers={
                    !isSatellite
                      ? {
                          click: () => onGardenClick(gardenNumber),
                          mouseover: () => onGardenHover?.(gardenNumber),
                          mouseout: () => onGardenHover?.(null),
                        }
                      : {}
                  }
                >
                  {showLabels && (
                    <Tooltip
                      permanent
                      direction="center"
                      className={`garden-label-tooltip garden-label-clickable ${isAvailable ? "garden-label-available" : ""}`}
                      opacity={1}
                    >
                      <span
                        className={`font-semibold transition-all ${
                          !isSatellite ? "cursor-pointer" : "cursor-default"
                        } ${
                          isAvailable
                            ? isHovered
                              ? "text-white bg-scholle-green-dark text-lg px-2 py-1 rounded-sm"
                              : "text-white bg-scholle-green hover:bg-scholle-green-dark hover:text-lg px-2 py-1 rounded-sm"
                            : "text-scholle-green-dark"
                        }`}
                        onClick={
                          !isSatellite
                            ? (e) => {
                                e.stopPropagation();
                                onGardenClick(gardenNumber);
                              }
                            : undefined
                        }
                        onMouseEnter={
                          !isSatellite ? () => onGardenHover?.(gardenNumber) : undefined
                        }
                        onMouseLeave={!isSatellite ? () => onGardenHover?.(null) : undefined}
                      >
                        {gardenNumber}
                      </span>
                    </Tooltip>
                  )}
                </Polygon>
              );
            })()}

          {/* Marker für ausgewählten Garten - nur wenn Labels NICHT sichtbar und in OSM-Karte */}
          {selectedGarden &&
            osmGeometry &&
            osmGeometry.length > 0 &&
            mapType === "osm" &&
            !showLabels &&
            (() => {
              const gardenNumber = selectedGarden.number;
              const isAvailable = availableGardens.some((g) => g.number === gardenNumber);
              const isHovered = hoveredGardenNumber === gardenNumber;

              // Berechne Zentrum der Geometrie
              const center = calculateGeometryCenter(osmGeometry);
              if (!center) return null;

              // Nur grünen Marker anzeigen wenn verfügbar
              if (isAvailable) {
                return (
                  <Marker
                    key={`selected-${selectedGarden.id}`}
                    position={[center.lat, center.lon]}
                    icon={isHovered ? HighlightedIcon : GreenIcon}
                    eventHandlers={{
                      click: () => onGardenClick(gardenNumber),
                      mouseover: () => onGardenHover?.(gardenNumber),
                      mouseout: () => onGardenHover?.(null),
                    }}
                  >
                    <Tooltip permanent={false}>Garten {gardenNumber}</Tooltip>
                  </Marker>
                );
              }
              return null;
            })()}

          {/* Marker für gefilterte Gärten - nur wenn in OSM gefunden und Labels NICHT sichtbar */}
          {availableMarkers}
        </MapContainer>
      )}
    </div>
  );
}
