import { useEffect, useRef, useState } from "react";
import { GOOGLE_3D_CONFIG, OSNABRUECK_BOUNDS } from "../utils/constants";
import { loadGoogleMaps } from "../utils/googleMaps";
import { calculateGardensBounds, calculateGeometryCenter } from "../utils/mapHelpers";
import type { OSMWay } from "../utils/osm";

interface Garden3DViewProps {
  allGardens: OSMWay[];
  selectedNumber: string | null;
  // Umriss des ausgewählten Gartens (kann auch fehlen, wenn er nicht in allGardens ist)
  selectedGeometry?: Array<{ lat: number; lon: number }>;
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

  // Kamera auf den ausgewählten Garten bzw. die ganze Anlage richten
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !maps3d) return;

    let camera: { center: { lat: number; lng: number; altitude: number }; range: number } | null =
      null;

    const selectedCenter = selectedGeometry ? calculateGeometryCenter(selectedGeometry) : null;
    if (selectedCenter) {
      const elevation = allGardens.find((g) => g.tags.ref === selectedNumber)?.elevation;
      camera = {
        center: {
          lat: selectedCenter.lat,
          lng: selectedCenter.lon,
          altitude: elevation ?? GOOGLE_3D_CONFIG.DEFAULT_ELEVATION,
        },
        range: GOOGLE_3D_CONFIG.GARDEN_RANGE,
      };
    } else if (allGardens.length > 0) {
      const { minLat, maxLat, minLon, maxLon, hasValidBounds } = calculateGardensBounds(allGardens);
      if (hasValidBounds) {
        camera = {
          center: {
            lat: (minLat + maxLat) / 2,
            lng: (minLon + maxLon) / 2,
            altitude: GOOGLE_3D_CONFIG.DEFAULT_ELEVATION,
          },
          range: GOOGLE_3D_CONFIG.OVERVIEW_RANGE,
        };
      }
    }

    if (camera) {
      Object.assign(map, { ...camera, tilt: GOOGLE_3D_CONFIG.TILT, heading: 0 });
    }
  }, [maps3d, allGardens, selectedNumber, selectedGeometry]);

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-scholle-bg-light p-6 text-center text-scholle-text-light">
        Die 3D-Ansicht konnte nicht geladen werden. Bitte versuchen Sie es später erneut.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
