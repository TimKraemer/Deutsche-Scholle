import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMap, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Garden } from '../types/garden';
import { osmGeometryToLeafletCoords } from '../utils/osm';
import type { OSMWay } from '../utils/osm';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapControllerProps {
  garden: Garden | null;
  osmGeometry?: Array<{ lat: number; lon: number }>;
}

function MapController({ garden }: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (garden && garden.bounds) {
      const [[minLat, minLon], [maxLat, maxLon]] = garden.bounds;
      map.fitBounds(
        [[minLat, minLon], [maxLat, maxLon]],
        { padding: [50, 50] }
      );
    } else if (garden && garden.coordinates) {
      map.setView(garden.coordinates, 18);
    }
  }, [garden, map]);

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

interface GardenPolygonProps {
  garden: OSMWay;
  isSelected: boolean;
  showLabels: boolean;
  onGardenClick: (gardenNumber: string) => void;
}

function GardenPolygon({ garden, isSelected, showLabels, onGardenClick }: GardenPolygonProps) {
  if (!garden.geometry || garden.geometry.length === 0) return null;

  const coords = osmGeometryToLeafletCoords(garden.geometry);
  const gardenNumber = garden.tags.name || '';

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
        color: isSelected ? '#22c55e' : '#6b7280',
        fillColor: isSelected ? '#22c55e' : '#9ca3af',
        fillOpacity: isSelected ? 0.3 : 0.1,
        weight: isSelected ? 2 : 1,
      }}
      eventHandlers={{
        click: handleClick,
      }}
    >
      {gardenNumber && showLabels && (
        <Tooltip
          permanent
          direction="center"
          className="garden-label-tooltip garden-label-clickable"
          opacity={1}
        >
          <span 
            className={`font-semibold cursor-pointer hover:underline ${isSelected ? 'text-green-700' : 'text-gray-700'}`}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
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
  onGardenClick: (gardenNumber: string) => void;
}

export default function GardenMap({ selectedGarden, osmGeometry, allGardens, onGardenClick }: GardenMapProps) {
  // Initiale Koordinaten für "Deutsche Scholle Osnabrück"
  const initialCenter: [number, number] = [52.2568, 8.02725];
  const initialZoom = 15;
  
  // Zoom-Level für Label-Anzeige (nur bei hohem Zoom und wenn kein Garten ausgewählt ist)
  const MIN_ZOOM_FOR_LABELS = 17;
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
  const showLabels = currentZoom >= MIN_ZOOM_FOR_LABELS && !selectedGarden;

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-gray-300">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController garden={selectedGarden} osmGeometry={osmGeometry} />
        <ZoomWatcher onZoomChange={setCurrentZoom} />
        
        {/* Zeige alle Gärten an */}
        {allGardens.map((garden) => {
          const isSelected = selectedGarden?.osmWayId === garden.id;
          return (
            <GardenPolygon
              key={garden.id}
              garden={garden}
              isSelected={isSelected}
              showLabels={showLabels}
              onGardenClick={onGardenClick}
            />
          );
        })}
        
        {selectedGarden && selectedGarden.coordinates && (
          <Marker position={selectedGarden.coordinates} />
        )}
      </MapContainer>
    </div>
  );
}

