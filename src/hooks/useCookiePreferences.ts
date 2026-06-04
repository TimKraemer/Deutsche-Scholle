import { useCallback, useEffect, useState } from "react";
import type { CookiePreferences } from "../types/cookies";
import { loadCookiePreferences } from "../utils/cookies";

/**
 * Verwaltet die Cookie-Präferenzen (Google Maps / OpenStreetMap).
 *
 * Lädt die gespeicherten Präferenzen beim Mount und stellt einen Handler
 * bereit, der die Zustimmung aus der Cookie-Consent-Komponente übernimmt.
 * Wird sowohl von der Startseite als auch von der Detailseite genutzt.
 */
export function useCookiePreferences() {
  const [cookiePreferences, setCookiePreferences] = useState<CookiePreferences>({
    googleMaps: false,
    openStreetMap: false,
  });

  useEffect(() => {
    setCookiePreferences(loadCookiePreferences());
  }, []);

  const handleConsentChange = useCallback(
    (preferences: { googleMaps: boolean | null; openStreetMap: boolean | null }) => {
      setCookiePreferences({
        googleMaps: preferences.googleMaps === true,
        openStreetMap: preferences.openStreetMap === true,
      });
    },
    []
  );

  return { cookiePreferences, setCookiePreferences, handleConsentChange };
}
