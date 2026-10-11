import { useEffect, useState } from "react";
import { type GardenData, getGardenData, type OSMWay, subscribeGardenData } from "../utils/osm";

// Stabile Referenz, damit Memos in der Karte nicht bei jedem Render neu rechnen
const NO_GARDENS: OSMWay[] = [];

/**
 * Stellt die OSM-Gartendaten bereit (Snapshot vom eigenen Server, ggf. im Hintergrund aktualisiert).
 *
 * @param enabled Nur laden, wenn die OpenStreetMap-Zustimmung vorliegt
 */
export function useGardenData(enabled: boolean) {
  const [data, setData] = useState<GardenData | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    setHasError(false);
    getGardenData()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error) => {
        console.error("Error loading garden data:", error);
        if (!cancelled) setHasError(true);
      });

    const unsubscribe = subscribeGardenData(setData);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enabled]);

  return {
    gardenData: enabled ? data : null,
    allGardens: (enabled && data?.gardens) || NO_GARDENS,
    isLoading: enabled && !data && !hasError,
    hasError: enabled && hasError,
  };
}
