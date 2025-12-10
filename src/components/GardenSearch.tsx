import { useMemo, useState } from "react";
import { mockGardens } from "../data/mockGardens";

interface GardenSearchProps {
  onSearch: (gardenNumber: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onErrorDismiss?: () => void;
}

export default function GardenSearch({
  onSearch,
  isLoading = false,
  error = null,
  onErrorDismiss,
}: GardenSearchProps) {
  const [gardenNumber, setGardenNumber] = useState("");

  // Wähle einen zufälligen Garten für den Platzhalter (einmalig beim Mount)
  const placeholderExample = useMemo(() => {
    if (mockGardens.length === 0) {
      return "1050";
    }
    const randomIndex = Math.floor(Math.random() * mockGardens.length);
    return mockGardens[randomIndex].number;
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gardenNumber.trim()) {
      onSearch(gardenNumber.trim());
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGardenNumber(e.target.value);
    // Entferne Fehler wenn Benutzer tippt
    if (error && onErrorDismiss) {
      onErrorDismiss();
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={gardenNumber}
          onChange={handleInputChange}
          placeholder={`Garten-Nr. (z.B. ${placeholderExample})`}
          className={`flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-scholle-green focus:border-transparent bg-scholle-bg-container ${
            error ? "border-red-300 bg-red-50" : "border-scholle-border"
          }`}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !gardenNumber.trim()}
          className="px-4 py-1.5 text-sm bg-scholle-green text-white rounded-lg hover:bg-scholle-green-dark disabled:bg-scholle-border disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {isLoading ? "Suche..." : "Suche"}
        </button>
      </form>
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between">
          <p className="text-red-800 text-sm flex-1">{error}</p>
          {onErrorDismiss && (
            <button
              onClick={onErrorDismiss}
              className="ml-3 text-red-600 hover:text-red-800 font-semibold"
              aria-label="Fehlermeldung schließen"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
