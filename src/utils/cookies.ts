/**
 * Cookie utility functions for managing cookie preferences
 */
import type { CookiePreferences } from '../types/cookies';

/**
 * Reads a cookie value by name
 */
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

/**
 * Loads cookie preferences from cookies
 */
export function loadCookiePreferences(): CookiePreferences {
  const savedGoogleMaps = getCookie('cookie_consent_google_maps');
  const savedOSM = getCookie('cookie_consent_openstreetmap');

  return {
    googleMaps: savedGoogleMaps === 'true',
    openStreetMap: savedOSM === 'true',
  };
}

/**
 * Checks if cookie preferences have been set
 */
export function hasCookiePreferences(): boolean {
  const googleMaps = getCookie('cookie_consent_google_maps');
  const osm = getCookie('cookie_consent_openstreetmap');
  return googleMaps !== null && osm !== null;
}

