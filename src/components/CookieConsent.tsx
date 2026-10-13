import { forwardRef, useImperativeHandle, useState } from "react";
import type { CookiePreferences } from "../types/cookies";
import { loadSavedConsent } from "../utils/cookies";
import CookieConsentContent from "./CookieConsentContent";

interface CookieConsentProps {
  onConsentChange: (preferences: CookiePreferences) => void;
  // Dialog sofort öffnen, wenn noch keine Entscheidung gespeichert ist (z.B. bei Direktlinks)
  openWhenUndecided?: boolean;
}

export interface CookieConsentRef {
  open: () => void;
}

const CookieConsent = forwardRef<CookieConsentRef, CookieConsentProps>(
  ({ onConsentChange, openWhenUndecided = false }, ref) => {
    const [showBanner, setShowBanner] = useState(() => {
      const saved = loadSavedConsent();
      return openWhenUndecided && (saved.googleMaps === null || saved.openStreetMap === null);
    });

    // Exponiere open-Methode über Ref
    useImperativeHandle(ref, () => ({
      open: () => {
        setShowBanner(true);
      },
    }));

    if (!showBanner) {
      return null;
    }

    return (
      <div className="fixed inset-0 bg-black/50 z-9999 flex items-center justify-center p-4">
        <CookieConsentContent
          onConsentChange={(prefs) => {
            onConsentChange(prefs);
            setShowBanner(false);
          }}
        />
      </div>
    );
  }
);

CookieConsent.displayName = "CookieConsent";

export default CookieConsent;
