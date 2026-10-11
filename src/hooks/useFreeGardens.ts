import { useEffect, useState } from "react";
import type { Garden } from "../types/garden";
import { type FreeGardenList, getFreeGardens } from "../utils/freeGardens";

// Stabile Referenz, damit Memos nicht bei jedem Render neu rechnen
const NO_GARDENS: Garden[] = [];

/** Stellt die Liste der freien Gärten des Vereins bereit (/freie-gaerten.json) */
export function useFreeGardens() {
  const [list, setList] = useState<FreeGardenList | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFreeGardens()
      .then((result) => {
        if (!cancelled) setList(result);
      })
      .catch((error) => {
        console.error("Error loading free gardens:", error);
        if (!cancelled) setHasError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    gardens: list?.gardens ?? NO_GARDENS,
    changedAt: list?.changedAt ?? null,
    isLoading: !list && !hasError,
    hasError,
  };
}
