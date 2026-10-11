import { useEffect, useMemo, useRef, useState } from "react";
import { GOOGLE_3D_CONFIG, OSNABRUECK_BOUNDS } from "../utils/constants";
import { loadGoogleMaps } from "../utils/googleMaps";
import { calculateGardensBounds, calculateGeometryCenter } from "../utils/mapHelpers";
import type { OSMWay } from "../utils/osm";

interface Garden3DViewProps {
  allGardens: OSMWay[];
  selectedNumber: string | null;
  // Umriss des ausgewählten Gartens (kann auch fehlen, wenn er nicht in allGardens ist)
  selectedGeometry?: Array<{ lat: number; lon: number }>;
  // Unsichtbar wird die Karte schon an der Startposition vorgeladen
  visible: boolean;
  // Kamera kreist um die Gartenmitte
  rotate: boolean;
  // Nutzer greift selbst in die Karte ein (Ziehen, Scrollen): Drehung beenden
  onUserInteraction?: () => void;
}

interface Camera {
  center: { lat: number; lng: number; altitude: number };
  range: number;
  tilt: number;
  heading: number;
}

// Viele Runden am Stück, damit die Drehung praktisch endlos läuft
const ROTATION_ROUNDS = 1000;

/**
 * Kameraabstand, bei dem der Garten das Bild gut füllt: Diagonale in Metern mal Faktor
 */
function closeRange(geometry: Array<{ lat: number; lon: number }>): number {
  const lats = geometry.map((p) => p.lat);
  const lons = geometry.map((p) => p.lon);
  const meanLat = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const heightM = (Math.max(...lats) - Math.min(...lats)) * 111320;
  const widthM = (Math.max(...lons) - Math.min(...lons)) * 111320 * Math.cos(meanLat);
  return Math.max(
    GOOGLE_3D_CONFIG.MIN_GARDEN_RANGE,
    Math.hypot(heightM, widthM) * GOOGLE_3D_CONFIG.GARDEN_RANGE_FACTOR
  );
}

/**
 * Fotorealistische 3D-Ansicht (Google Map3DElement) mit den Gartenumrissen.
 *
 * Ersetzt die 45°-Schrägluftbilder: Google hat sie mit Maps JS API 3.65 für Rasterkarten
 * abgeschaltet, mit Neigung blieb die Karte grau.
 */
export default function Garden3DView({
  allGardens,
  selectedNumber,
  selectedGeometry,
  visible,
  rotate,
  onUserInteraction,
}: Garden3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [maps3d, setMaps3d] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);

  // Karte einmal erzeugen
  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((google) => google.maps.importLibrary("maps3d"))
      .then((library) => {
        if (cancelled || !containerRef.current) return;
        const map = new library.Map3DElement({
          mode: library.MapMode.SATELLITE,
          bounds: OSNABRUECK_BOUNDS,
        });
        map.style.width = "100%";
        map.style.height = "100%";
        containerRef.current.appendChild(map);
        mapRef.current = map;
        setMaps3d(library);
      })
      .catch((error) => {
        console.error("Error loading Google 3D map:", error);
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Gartenumrisse zeichnen (bei neuen Daten oder anderem Garten neu)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !maps3d) return;

    const polygons: any[] = [];
    const addPolygon = (geometry: Array<{ lat: number; lon: number }>, isSelected: boolean) => {
      if (geometry.length < 3) return;
      const polygon = new maps3d.Polygon3DElement({
        altitudeMode: maps3d.AltitudeMode.CLAMP_TO_GROUND,
        strokeColor: isSelected ? "#00FF00" : "rgba(255, 255, 255, 0.6)",
        strokeWidth: isSelected ? 4 : 1.5,
        fillColor: isSelected ? "rgba(0, 255, 0, 0.15)" : "rgba(0, 0, 0, 0)",
        // Ausgewählten Garten auch durch Bäume und Dächer hindurch zeigen
        drawsOccludedSegments: isSelected,
      });
      polygon.path = geometry.map((p) => ({ lat: p.lat, lng: p.lon }));
      map.append(polygon);
      polygons.push(polygon);
    };

    for (const garden of allGardens) {
      if (garden.tags.ref !== selectedNumber) {
        addPolygon(garden.geometry ?? [], false);
      }
    }
    if (selectedGeometry) {
      addPolygon(selectedGeometry, true);
    }

    return () => {
      for (const polygon of polygons) {
        polygon.remove();
      }
    };
  }, [maps3d, allGardens, selectedNumber, selectedGeometry]);

  // Startkamera: ganz nah am ausgewählten Garten, sonst Übersicht über die Anlage
  const startCamera = useMemo((): Camera | null => {
    const selectedCenter = selectedGeometry ? calculateGeometryCenter(selectedGeometry) : null;
    if (selectedGeometry && selectedCenter) {
      const elevation = allGardens.find((g) => g.tags.ref === selectedNumber)?.elevation;
      return {
        center: {
          lat: selectedCenter.lat,
          lng: selectedCenter.lon,
          altitude: elevation ?? GOOGLE_3D_CONFIG.DEFAULT_ELEVATION,
        },
        range: closeRange(selectedGeometry),
        tilt: GOOGLE_3D_CONFIG.TILT,
        heading: 0,
      };
    }

    const { minLat, maxLat, minLon, maxLon, hasValidBounds } = calculateGardensBounds(allGardens);
    if (!hasValidBounds) return null;
    return {
      center: {
        lat: (minLat + maxLat) / 2,
        lng: (minLon + maxLon) / 2,
        altitude: GOOGLE_3D_CONFIG.DEFAULT_ELEVATION,
      },
      range: GOOGLE_3D_CONFIG.OVERVIEW_RANGE,
      tilt: GOOGLE_3D_CONFIG.TILT,
      heading: 0,
    };
  }, [allGardens, selectedNumber, selectedGeometry]);

  // Merkt sich Kamera und Sichtbarkeit des letzten Durchlaufs, um zu erkennen, ob die Kamera
  // zurückgesetzt werden muss oder nur die Drehung an- bzw. ausgeschaltet wurde
  const lastStateRef = useRef<{ camera: Camera | null; visible: boolean } | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !maps3d || !startCamera) return;

    const last = lastStateRef.current;
    lastStateRef.current = { camera: startCamera, visible };
    const reset = !last || last.camera !== startCamera || last.visible !== visible;

    map.stopCameraAnimation();
    if (reset) {
      // Auch unsichtbar an die Startposition, damit die Kacheln dort schon geladen sind
      Object.assign(map, startCamera);
    }

    if (visible && rotate && selectedGeometry) {
      // Von der aktuellen Blickrichtung aus weiterdrehen, Mittelpunkt bleibt der Garten
      map.flyCameraAround({
        camera: {
          center: startCamera.center,
          range: map.range,
          tilt: map.tilt,
          heading: map.heading,
        },
        // Dauer einer Umrundung, nicht der gesamten Animation
        durationMillis: GOOGLE_3D_CONFIG.ROTATION_SECONDS * 1000,
        repeatCount: ROTATION_ROUNDS,
      });
    }
  }, [maps3d, startCamera, visible, rotate, selectedGeometry]);

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-scholle-bg-light p-6 text-center text-scholle-text-light">
        Die 3D-Ansicht konnte nicht geladen werden. Bitte versuchen Sie es später erneut.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      onPointerDown={rotate ? onUserInteraction : undefined}
      onWheel={rotate ? onUserInteraction : undefined}
    />
  );
}
