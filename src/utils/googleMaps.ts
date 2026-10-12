// Google Maps API Key aus Umgebungsvariable
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const CALLBACK_NAME = "initGoogleMapsCallback";

// Fest auf 3.64: die letzte Version mit 45°-Schrägluftbildern (in 3.65 abgeschaltet).
// Zieht Google 3.64 zurück, liefert es automatisch eine neuere Version aus. Die Schrägansicht
// wird dann ausgeblendet (siehe supportsObliqueImagery), alles andere läuft weiter.
const MAPS_API_VERSION = "3.64";

let loadPromise: Promise<any> | null = null;

function getGoogle(): any {
  return (window as any).google;
}

/**
 * Lädt die Google Maps JavaScript API genau einmal und liefert das google-Objekt.
 * Wird von der flachen Luftbildkarte und der fotorealistischen 3D-Ansicht geteilt.
 */
export function loadGoogleMaps(): Promise<any> {
  if (getGoogle()?.maps?.LatLngBounds) {
    return Promise.resolve(getGoogle());
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      (window as any)[CALLBACK_NAME] = () => resolve(getGoogle());

      const script = document.createElement("script");
      // Feste Version statt "weekly": stabiler, und nur 3.64 hat noch 45°-Bilder
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=${MAPS_API_VERSION}&libraries=geometry&loading=async&callback=${CALLBACK_NAME}`;
      script.async = true;
      script.onerror = () => {
        // Beim nächsten Aufruf erneut versuchen
        script.remove();
        loadPromise = null;
        reject(new Error("Failed to load Google Maps API"));
      };
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}

/**
 * Ob die geladene API-Version noch 45°-Schrägluftbilder liefert
 */
export function supportsObliqueImagery(): boolean {
  return getGoogle()?.maps?.version?.startsWith(`${MAPS_API_VERSION}.`) ?? false;
}
