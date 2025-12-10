import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import CookieConsentContent from "./CookieConsentContent";

interface CookiePreferences {
  googleMaps: boolean | null;
  openStreetMap: boolean | null;
}

interface CookieConsentProps {
  onConsentChange: (preferences: CookiePreferences) => void;
}

export interface CookieConsentRef {
  open: () => void;
}

const CookieConsent = forwardRef<CookieConsentRef, CookieConsentProps>(
  ({ onConsentChange }, ref) => {
    const [showBanner, setShowBanner] = useState(false);
    const [googleMapsConsent, setGoogleMapsConsent] = useState<boolean | null>(null);
    const [openStreetMapConsent, setOpenStreetMapConsent] = useState<boolean | null>(null);

    // Exponiere open-Methode über Ref
    useImperativeHandle(ref, () => ({
      open: () => {
        setShowBanner(true);
      },
    }));

    const getCookie = useCallback((name: string): string | null => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(";").shift() || null;
      }
      return null;
    }, []);

    useEffect(() => {
      // Prüfe ob bereits Zustimmungen gespeichert sind
      const savedGoogleMaps = getCookie("cookie_consent_google_maps");
      const savedOSM = getCookie("cookie_consent_openstreetmap");

      if (savedGoogleMaps !== null && savedOSM !== null) {
        // Lade gespeicherte Zustimmungen
        const googleMaps = savedGoogleMaps === "true";
        const osm = savedOSM === "true";
        setGoogleMapsConsent(googleMaps);
        setOpenStreetMapConsent(osm);
        onConsentChange({ googleMaps, openStreetMap: osm });
      } else {
        // Setze initiale Werte auf null wenn noch keine Zustimmung vorhanden
        setGoogleMapsConsent(null);
        setOpenStreetMapConsent(null);
      }
    }, []);

    if (!showBanner) {
      return null;
    }

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-9999 flex items-center justify-center p-4">
        <CookieConsentContent
          onConsentChange={(prefs) => {
            onConsentChange(prefs);
            setShowBanner(false);
          }}
          initialGoogleMaps={googleMapsConsent}
          initialOpenStreetMap={openStreetMapConsent}
        />
      </div>
    );
  }
);

CookieConsent.displayName = "CookieConsent";

export default CookieConsent;
