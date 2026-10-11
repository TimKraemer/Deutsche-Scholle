import { useCallback, useState } from "react";
import type { CookiePreferences } from "../types/cookies";
import { loadCookiePreferences } from "../utils/cookies";

/**
 * Verwaltet die Cookie-Präferenzen (Google Maps / OpenStreetMap).
 *
 * Liest die gespeicherten Präferenzen beim ersten Render und stellt einen Handler
 * bereit, der die Zustimmung aus der Cookie-Consent-Komponente übernimmt.
 * Wird sowohl von der Startseite als auch von der Detailseite genutzt.
 */
export function useCookiePreferences() {
  // Direkt beim ersten Render aus den Cookies lesen. Sonst rendert die Seite erst ohne
  // Zustimmung (Hinweise blitzen auf) und startet alle Lade-Effekte ein zweites Mal.
  const [cookiePreferences, setCookiePreferences] =
    useState<CookiePreferences>(loadCookiePreferences);

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
