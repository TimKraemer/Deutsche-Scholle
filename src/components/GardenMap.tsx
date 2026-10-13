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
import { GOOGLE_MAPS_API_KEY, loadGoogleMaps, supportsObliqueImagery } from "../utils/googleMaps";
import {
  applyBoundsPadding,
  calculateGardensBounds,
  calculateGeometryCenter,
  isValidCoordinate,
} from "../utils/mapHelpers";
import type { OSMWay } from "../utils/osm";
import { osmGeometryToLeafletCoords } from "../utils/osm";
import CookieConsentHint from "./CookieConsentHint";
import Garden3DView from "./Garden3DView";

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

type MapType = "osm" | "3d";

/**
 * Schaltet die Google-Rasterkarte zwischen Draufsicht und 45°-Schrägluftbild um.
 * Schrägbilder gibt es nur ab Zoom 18 und bis Zoom 21, darum wird der Zoom eingegrenzt.
 */
function applyOblique(map: any, oblique: boolean) {
  if (oblique) {
    const zoom = map.getZoom() ?? GOOGLE_MAPS_CONFIG.GARDEN_ZOOM;
    map.setZoom(Math.min(Math.max(zoom, 19), 21));
    map.setTilt(45);
  } else {
    map.setTilt(0);
  }
  map.setHeading(0);
}

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
      const validPoints = (osmGeometry ?? []).filter((point) =>
        isValidCoordinate(point.lat, point.lon)
      );
      if (!garden || validPoints.length < 3) return;

      const lats = validPoints.map((p) => p.lat);
      const lons = validPoints.map((p) => p.lon);
      // Padding sorgt dafür, dass der Garten nicht am Rand klebt
      map.fitBounds(
        [
          [Math.min(...lats), Math.min(...lons)],
          [Math.max(...lats), Math.max(...lons)],
        ],
        { padding: [50, 50], maxZoom: 20 }
      );
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
  isAvailable?: boolean; // Ist der Garten ein freier Garten?
  hoveredGardenNumber?: string | null;
  onGardenHover?: (gardenNumber: string | null) => void;
}

function GardenPolygon({
  garden,
  isSelected,
  showLabels,
  onGardenClick,
  isAvailable = false,
  hoveredGardenNumber,
  onGardenHover,
}: GardenPolygonProps) {
  if (!garden.geometry || garden.geometry.length === 0) return null;

  const coords = osmGeometryToLeafletCoords(garden.geometry);
  const gardenNumber = garden.tags.ref || ""; // ref ist das Standard-Tag für Gartennummern
  const isHovered = hoveredGardenNumber === gardenNumber;

  const handleClick = () => {
    if (gardenNumber) {
      onGardenClick(gardenNumber);
    }
  };

  return (
    <Polygon
      key={garden.id}
      positions={coords}
      pathOptions={{
        color: isSelected ? "#22c55e" : "#6b7280",
        fillColor: isSelected ? "#22c55e" : "#9ca3af",
        fillOpacity: isSelected ? 0.3 : 0.1,
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
          className={`garden-label-tooltip garden-label-clickable ${isAvailable ? "garden-label-available" : ""}`}
          opacity={1}
        >
          <span
            className={`font-semibold transition-all cursor-pointer ${
              isAvailable
                ? isHovered
                  ? "text-white bg-scholle-green-dark text-lg px-2 py-1 rounded-sm"
                  : "text-white bg-scholle-green hover:bg-scholle-green-dark hover:text-lg px-2 py-1 rounded-sm"
                : isSelected
                  ? "text-scholle-green-dark"
                  : "text-scholle-text hover:text-scholle-green"
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
  // Luftbild nur als Standard, wenn Google Maps erlaubt ist. Sonst sähe man statt der Karte
  // nur den Zustimmungs-Hinweis, obwohl die OSM-Karte verfügbar wäre.
  const preferredMapType =
    defaultMapType === "3d" && !cookiePreferences.googleMaps ? "osm" : defaultMapType;
  const [mapType, setMapType] = useState<MapType>(preferredMapType);
  // Folgt dem Standard nur, solange der Nutzer nicht selbst umgeschaltet hat
  const userPickedMapTypeRef = useRef(false);
  useEffect(() => {
    if (!userPickedMapTypeRef.current) {
      setMapType(preferredMapType);
    }
  }, [preferredMapType]);
  const selectMapType = (type: MapType) => {
    userPickedMapTypeRef.current = true;
    setMapType(type);
  };

  // Luftbild startet flach von oben. Das 3D-Modell wird im Hintergrund vorgeladen und erst
  // auf Klick eingeblendet, dann kreist die Kamera um den Garten (abschaltbar).
  const [is3DEnabled, setIs3DEnabled] = useState(false);
  const [isRotating, setIsRotating] = useState(true);

  // Die vier Ansichten der Knopfleiste, alle jederzeit anklickbar
  type MapView = "karte" | "luftbild" | "schraeg" | "3d";

  // 45°-Schrägluftbild: Google-Luftbild mit Neigung (nur mit Maps API 3.64 verfügbar)
  const [isOblique, setIsOblique] = useState(false);
  const isObliqueRef = useRef(isOblique);
  isObliqueRef.current = isOblique;
  const [obliqueAvailable, setObliqueAvailable] = useState(true);

  const activeView: MapView =
    mapType === "osm"
      ? "karte"
      : mapType === "3d" && is3DEnabled
        ? "3d"
        : mapType === "3d" && isOblique
          ? "schraeg"
          : "luftbild";
  const selectView = (view: MapView) => {
    if (view === "karte") selectMapType("osm");
    if (view === "luftbild" || view === "schraeg" || view === "3d") selectMapType("3d");
    setIs3DEnabled(view === "3d");
    setIsOblique(view === "schraeg");
    if (view === "3d") setIsRotating(true);
  };
  const mapViews: { view: MapView; label: string; title: string }[] = [
    { view: "karte", label: "Karte", title: "Straßenkarte (OpenStreetMap)" },
    { view: "luftbild", label: "Luftbild", title: "Luftbild von oben (Google)" },
    {
      view: "schraeg",
      label: "45°",
      title: "Schrägluftbild aus 45° (Google), Blickrichtung mit den Pfeilen rechts drehen",
    },
    { view: "3d", label: "3D", title: "Fotorealistisches 3D-Modell (Google)" },
  ];

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

  // Gartennummer -> OSM-Garten. Bei doppelten Nummern gilt wie in findOsmGarden der erste Treffer.
  const osmGardenMap = useMemo(() => {
    const byRef = new Map<string, OSMWay>();
    for (const garden of allGardens) {
      if (!byRef.has(garden.tags.ref)) byRef.set(garden.tags.ref, garden);
    }
    return byRef;
  }, [allGardens]);

  // Memoize garden polygons (only render when not in 3D mode)
  // Verhindert unnötige Neuberechnung bei jedem Render (Performance-Optimierung)
  const gardenPolygons = useMemo(() => {
    if (mapType === "3d") return []; // In 3D-Modus werden Polygone nicht gerendert

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
        if (!osmGarden?.geometry || osmGarden.geometry.length === 0) {
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
  // Garten, auf den das Luftbild zuletzt eingepasst wurde ("" = Übersicht)
  const lastFitRef = useRef<string | null>(null);

  useEffect(() => {
    const map = googleMapInstanceRef.current;
    if (map) applyOblique(map, isOblique);
  }, [isOblique]);

  // 45° nur anbieten, solange Google die API-Version mit Schrägbildern noch ausliefert
  useEffect(() => {
    if (disable3D || !cookiePreferences.googleMaps) return;
    loadGoogleMaps()
      .then(() => {
        const available = supportsObliqueImagery();
        setObliqueAvailable(available);
        if (!available) setIsOblique(false);
      })
      .catch(() => {});
  }, [disable3D, cookiePreferences.googleMaps]);
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

  // Flaches Google-Luftbild (Luftbild mit ausgeschaltetem 3D). Die 3D-Ansicht rendert Garden3DView.
  // Die Karte entsteht einmal je Container, weil jede neue Karte ein abgerechneter Kartenaufruf
  // ist. Bei neuen Daten werden nur die Umrisse neu gezeichnet.
  useEffect(() => {
    const container = googleMap3DRef.current;
    if (mapType !== "3d" || !container) {
      googleMapInstanceRef.current = null;
      return;
    }

    if (!cookiePreferences.googleMaps || !cookiePreferences.openStreetMap) {
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.error("Google Maps API Key nicht gefunden");
      return;
    }

    // Auf die Umrisse warten, sonst stünde die Karte an der Standardposition
    if (selectedGarden ? !osmGeometry : allGardens.length === 0) {
      return;
    }

    let cancelled = false;
    const polygons: any[] = [];

    loadGoogleMaps()
      .then((google) => {
        if (cancelled) return;
        const toPath = (geometry: Array<{ lat: number; lon: number }>) =>
          geometry
            .filter((point) => isValidCoordinate(point.lat, point.lon))
            .map((point) => new google.maps.LatLng(point.lat, point.lon));

        // Ausgewählter Garten oder alle Gärten für die Übersicht
        const bounds = new google.maps.LatLngBounds();
        const focus = selectedGarden
          ? [toPath(osmGeometry ?? [])]
          : allGardens.map((g) => toPath(g.geometry ?? []));
        for (const path of focus) {
          for (const point of path) bounds.extend(point);
        }

        let map = googleMapInstanceRef.current;
        if (!map || map.getDiv() !== container) {
          map = new google.maps.Map(container, {
            center: bounds.isEmpty()
              ? { lat: INITIAL_MAP_CENTER[0], lng: INITIAL_MAP_CENTER[1] }
              : bounds.getCenter(),
            zoom: selectedGarden ? GOOGLE_MAPS_CONFIG.GARDEN_ZOOM : GOOGLE_MAPS_CONFIG.DEFAULT_ZOOM,
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            // Neigung erst nach dem Laden setzen: direkt beim Erzeugen bleibt die Karte sonst grau
            tilt: 0,
            rotateControl: true,
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
          lastFitRef.current = null;
          google.maps.event.addListenerOnce(map, "tilesloaded", () => {
            if (isObliqueRef.current) applyOblique(map, true);
          });
        }

        // Umrisse nur zur Ansicht, im Luftbild nicht klickbar. Polygone brauchen mindestens 3 Punkte.
        for (const garden of allGardens) {
          const path = toPath(garden.geometry ?? []);
          if (path.length < 3) continue;
          const isSelected = garden.tags.ref === selectedGarden?.number;
          polygons.push(
            new google.maps.Polygon({
              paths: path,
              strokeColor: isSelected ? "#00FF00" : "#888888",
              strokeOpacity: isSelected ? 1.0 : 0.5,
              strokeWeight: isSelected ? 3 : 1,
              fillOpacity: 0,
              map,
            })
          );
        }

        // Nur bei neuer Karte oder anderem Garten einpassen, nicht bei jeder Datenaktualisierung.
        // Google Maps braucht nach dem Erzeugen einen Moment, bevor fitBounds greift.
        const fitKey = selectedGarden?.number ?? "";
        if (lastFitRef.current !== fitKey && !bounds.isEmpty()) {
          lastFitRef.current = fitKey;
          setTimeout(() => map.fitBounds(bounds), 100);
        }
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
      for (const polygon of polygons) {
        polygon.setMap(null);
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
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-1001 bg-scholle-bg-container rounded-lg shadow-lg p-1 flex flex-wrap justify-center gap-1 border border-scholle-border w-max max-w-[calc(100%-1rem)]">
          {mapViews
            .filter(({ view }) => view !== "schraeg" || obliqueAvailable)
            .map(({ view, label, title }) => (
              <button
                key={view}
                onClick={() => selectView(view)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  activeView === view
                    ? "bg-scholle-green text-white"
                    : "bg-scholle-bg-light text-scholle-text hover:bg-scholle-border"
                }`}
                title={title}
                aria-pressed={activeView === view}
              >
                {label}
              </button>
            ))}
          {activeView === "3d" && (
            <button
              onClick={() => setIsRotating((prev) => !prev)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                isRotating
                  ? "bg-scholle-green text-white"
                  : "bg-scholle-bg-light text-scholle-text hover:bg-scholle-border"
              }`}
              title={isRotating ? "Drehung anhalten" : "Kamera um den Garten drehen"}
              aria-pressed={isRotating}
            >
              Drehen
            </button>
          )}
        </div>
      )}

      {/* Fotorealistisches 3D-Modell: wird mit Google-Zustimmung schon vorgeladen (unsichtbar
          an der Startposition) und liegt eingeblendet über dem flachen Luftbild */}
      {!disable3D && cookiePreferences.googleMaps && cookiePreferences.openStreetMap && (
        <div
          className={`absolute inset-0 z-10 transition-opacity duration-300 ${
            mapType === "3d" && is3DEnabled ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden={!(mapType === "3d" && is3DEnabled)}
        >
          <Garden3DView
            allGardens={allGardens}
            selectedNumber={selectedGarden?.number ?? null}
            selectedGeometry={selectedGarden ? osmGeometry : undefined}
            visible={mapType === "3d" && is3DEnabled}
            rotate={isRotating}
            onUserInteraction={() => setIsRotating(false)}
          />
        </div>
      )}

      {/* Google Luftbild flach von oben (3D-Modell liegt als eigene Ebene darüber) */}
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
          maxZoom={19}
          minZoom={13}
          maxBounds={osnabrueckLeafletBounds}
          maxBoundsViscosity={1.0}
        >
          {cookiePreferences.openStreetMap ? (
            <TileLayer
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

          {/* Marker für gefilterte Gärten - nur wenn in OSM gefunden und Labels NICHT sichtbar */}
          {availableMarkers}
        </MapContainer>
      )}
    </div>
  );
}
