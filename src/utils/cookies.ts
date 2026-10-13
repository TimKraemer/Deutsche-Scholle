/**
 * Cookie utility functions for managing cookie preferences
 */
import type { CookiePreferences } from "../types/cookies";

const GOOGLE_MAPS_COOKIE = "cookie_consent_google_maps";
const OSM_COOKIE = "cookie_consent_openstreetmap";

/**
 * Reads a cookie value by name
 */
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
}

const toConsent = (value: string | null) => (value === null ? null : value === "true");

/**
 * Gespeicherte Entscheidung je Dienst, null = noch nicht entschieden
 */
export function loadSavedConsent(): {
  googleMaps: boolean | null;
  openStreetMap: boolean | null;
} {
  return {
    googleMaps: toConsent(getCookie(GOOGLE_MAPS_COOKIE)),
    openStreetMap: toConsent(getCookie(OSM_COOKIE)),
  };
}

/**
 * Loads cookie preferences from cookies (undecided counts as no consent)
 */
export function loadCookiePreferences(): CookiePreferences {
  const saved = loadSavedConsent();
  return {
    googleMaps: saved.googleMaps === true,
    openStreetMap: saved.openStreetMap === true,
  };
}

/**
 * Speichert die Entscheidung für ein Jahr
 */
export function saveCookiePreferences(preferences: CookiePreferences): void {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  const attributes = `expires=${expires};path=/;SameSite=Lax`;
  document.cookie = `${GOOGLE_MAPS_COOKIE}=${preferences.googleMaps};${attributes}`;
  document.cookie = `${OSM_COOKIE}=${preferences.openStreetMap};${attributes}`;
}
