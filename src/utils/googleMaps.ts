// Google Maps API Key aus Umgebungsvariable
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const CALLBACK_NAME = "initGoogleMapsCallback";

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
      // v=quarterly: stabiler Release-Kanal. Der Standard-Kanal "weekly" verursacht
      // gelegentlich transiente Loader-Fehler ("Could not load \"controls\"").
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=quarterly&libraries=geometry&loading=async&callback=${CALLBACK_NAME}`;
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
