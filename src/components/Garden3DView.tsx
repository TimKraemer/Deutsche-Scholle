import { useEffect, useRef } from 'react';
import type { Garden } from '../types/garden';

interface Garden3DViewProps {
  garden: Garden | null;
  osmGeometry?: Array<{ lat: number; lon: number }>;
}

// Google Maps API wird dynamisch geladen
// Die Typen werden zur Laufzeit verfügbar sein

export default function Garden3DView({ garden, osmGeometry }: Garden3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null); // google.maps.Map
  const polygonRef = useRef<any>(null); // google.maps.Polygon
  const scriptLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!containerRef.current || !garden || !osmGeometry || osmGeometry.length < 3) {
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API Key nicht gefunden');
      return;
    }

    const initMap = () => {
      if (!containerRef.current || !(window as any).google) {
        return;
      }

      const google = (window as any).google;

      // Berechne Zentrum und Bounds
      const bounds = new google.maps.LatLngBounds();
      const path = osmGeometry.map(point => {
        const latLng = new google.maps.LatLng(point.lat, point.lon);
        bounds.extend(latLng);
        return latLng;
      });

      // Erstelle Map mit 3D-Features
      const map = new google.maps.Map(containerRef.current, {
        center: bounds.getCenter(),
        zoom: 18,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        tilt: 45, // Neige die Kamera für 3D-Ansicht
        heading: 0,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        // Aktiviere 3D-Gebäude (automatisch bei hohem Zoom und Tilt)
        styles: [],
      });

      mapRef.current = map;

      // Erstelle Polygon für den Garten
      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: '#00FF00',
        strokeOpacity: 1.0,
        strokeWeight: 3,
        fillColor: '#00FF00',
        fillOpacity: 0.35,
        map: map,
      });

      polygonRef.current = polygon;

      // Zoome zur Gartenfläche
      map.fitBounds(bounds);

      // Füge Marker mit Label hinzu
      const center = bounds.getCenter();
      new google.maps.Marker({
        position: center,
        map: map,
        label: {
          text: `Garten ${garden.number}`,
          color: '#FFFFFF',
          fontSize: '16px',
          fontWeight: 'bold',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0, // Unsichtbar, nur Label sichtbar
        },
      });

      // Nach dem Laden der Karte, stelle sicher dass 3D aktiviert ist
      google.maps.event.addListenerOnce(map, 'tilesloaded', () => {
        // Setze Tilt erneut, um 3D-Gebäude zu aktivieren
        map.setTilt(45);
        map.setZoom(map.getZoom() || 18);
      });
    };

    // Lade Google Maps API Script falls noch nicht geladen
    if (!scriptLoadedRef.current && !(window as any).google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        scriptLoadedRef.current = true;
        initMap();
      };
      document.head.appendChild(script);
    } else if ((window as any).google) {
      initMap();
    }

    // Cleanup
    return () => {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current = null;
      }
    };
  }, [garden, osmGeometry]);

  if (!garden || !osmGeometry || osmGeometry.length < 3) {
    return (
      <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">3D-Ansicht nicht verfügbar</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-gray-300 bg-gray-900">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
