import { useState } from "react";
import type { CookiePreferences } from "../types/cookies";
import { loadCookiePreferences } from "../utils/cookies";

/**
 * Verwaltet die Cookie-Präferenzen (Google Maps / OpenStreetMap).
 *
 * Liest die gespeicherten Präferenzen beim ersten Render. handleConsentChange übernimmt
 * die Entscheidung aus der Cookie-Consent-Komponente.
 * Wird sowohl von der Startseite als auch von der Detailseite genutzt.
 */
export function useCookiePreferences() {
  // Direkt beim ersten Render aus den Cookies lesen. Sonst rendert die Seite erst ohne
  // Zustimmung (Hinweise blitzen auf) und startet alle Lade-Effekte ein zweites Mal.
  const [cookiePreferences, setCookiePreferences] =
    useState<CookiePreferences>(loadCookiePreferences);

  return { cookiePreferences, handleConsentChange: setCookiePreferences };
}
