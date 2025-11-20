import { useState } from 'react';
import type { Garden } from '../types/garden';

interface GardenDetailsProps {
  garden: Garden | null;
}

export default function GardenDetails({ garden }: GardenDetailsProps) {
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);

  if (!garden) {
    return (
      <div className="w-full p-6 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500 text-center">
          Kein Garten ausgewählt. Geben Sie eine Garten-Nummer ein und suchen Sie.
        </p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getWaterConnectionLabel = (type: string) => {
    switch (type) {
      case 'brunnen':
        return 'Brunnen';
      case 'wasserleitung':
        return 'Wasserleitung (Stadtwerke)';
      case 'brunnen-aussen':
        return 'Brunnen außerhalb des Gartens';
      case 'kein':
        return 'Kein Wasseranschluss';
      default:
        return type;
    }
  };

  const getWaterIcon = (type: string) => {
    switch (type) {
      case 'brunnen':
        return '💧';
      case 'wasserleitung':
        return '🚰';
      case 'brunnen-aussen':
        return '🌊';
      case 'kein':
        return '❌';
      default:
        return '💧';
    }
  };

  const getElectricityIcon = (hasElectricity: boolean) => {
    return hasElectricity ? '⚡' : '❌';
  };

  return (
    <div className="w-full p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Gartendetails</h2>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Garten-Nr.
            </label>
            <p className="text-lg font-semibold text-gray-900">{garden.number}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Parzelle
            </label>
            <p className="text-lg text-gray-900">{garden.parcel || '-'}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Größe
          </label>
          <div className="space-y-1">
            <p className="text-lg text-gray-900">
              {garden.size} m² <span className="text-sm text-gray-500">(Datenbank)</span>
            </p>
            {garden.osmSize !== undefined && garden.osmSize !== null && (
              <p className="text-sm text-gray-500">
                {garden.osmSize} m² <span className="text-xs">(OSM berechnet)</span>
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Frei ab
          </label>
          <p className="text-lg text-gray-900">{formatDate(garden.availableFrom)}</p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Ausstattung
          </label>
          <div className="flex gap-4">
            {/* Stromanschluss */}
            <div className="relative">
              <button
                className={`text-3xl transition-transform hover:scale-110 cursor-pointer ${
                  garden.hasElectricity ? 'text-yellow-500' : 'text-gray-400'
                }`}
                onMouseEnter={() => setHoveredIcon('electricity')}
                onMouseLeave={() => setHoveredIcon(null)}
                onClick={() => setHoveredIcon(hoveredIcon === 'electricity' ? null : 'electricity')}
                aria-label="Stromanschluss"
              >
                {getElectricityIcon(garden.hasElectricity)}
              </button>
              {hoveredIcon === 'electricity' && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap pointer-events-none z-[1000]">
                  {garden.hasElectricity ? 'Stromanschluss vorhanden' : 'Kein Stromanschluss'}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>

            {/* Wasseranschluss */}
            <div className="relative">
              <button
                className={`text-3xl transition-transform hover:scale-110 cursor-pointer ${
                  garden.waterConnection !== 'kein' ? 'text-blue-500' : 'text-gray-400'
                }`}
                onMouseEnter={() => setHoveredIcon('water')}
                onMouseLeave={() => setHoveredIcon(null)}
                onClick={() => setHoveredIcon(hoveredIcon === 'water' ? null : 'water')}
                aria-label="Wasseranschluss"
              >
                {getWaterIcon(garden.waterConnection)}
              </button>
              {hoveredIcon === 'water' && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap pointer-events-none z-[1000]">
                  {getWaterConnectionLabel(garden.waterConnection)}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Wertermittlung
            </label>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(garden.valuation)}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Wertminderung
            </label>
            <p className="text-lg font-semibold text-red-600">
              {formatCurrency(garden.valueReduction)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

