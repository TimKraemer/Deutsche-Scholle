import { useState } from 'react';

interface GardenSearchProps {
  onSearch: (gardenNumber: string) => void;
  isLoading?: boolean;
}

export default function GardenSearch({ onSearch, isLoading = false }: GardenSearchProps) {
  const [gardenNumber, setGardenNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gardenNumber.trim()) {
      onSearch(gardenNumber.trim());
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={gardenNumber}
          onChange={(e) => setGardenNumber(e.target.value)}
          placeholder="Garten-Nr. eingeben (z.B. 1050)"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !gardenNumber.trim()}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Suche...' : 'Suche'}
        </button>
      </form>
    </div>
  );
}

