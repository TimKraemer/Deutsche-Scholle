import { useEffect, useState } from "react";

interface CookiePreferences {
  googleMaps: boolean | null;
  openStreetMap: boolean | null;
}

interface CookieConsentContentProps {
  onConsentChange: (preferences: CookiePreferences) => void;
  initialGoogleMaps?: boolean | null;
  initialOpenStreetMap?: boolean | null;
}

export default function CookieConsentContent({
  onConsentChange,
  initialGoogleMaps = null,
  initialOpenStreetMap = null,
}: CookieConsentContentProps) {
  const [googleMapsConsent, setGoogleMapsConsent] = useState<boolean | null>(initialGoogleMaps);
  const [openStreetMapConsent, setOpenStreetMapConsent] = useState<boolean | null>(
    initialOpenStreetMap
  );

  useEffect(() => {
    // Lade gespeicherte Cookie-Werte wenn initial nicht gesetzt
    if (initialGoogleMaps === null || initialOpenStreetMap === null) {
      const getCookie = (name: string): string | null => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
          return parts.pop()?.split(";").shift() || null;
        }
        return null;
      };

      const savedGoogleMaps = getCookie("cookie_consent_google_maps");
      const savedOSM = getCookie("cookie_consent_openstreetmap");

      if (savedGoogleMaps !== null) {
        setGoogleMapsConsent(savedGoogleMaps === "true");
      }
      if (savedOSM !== null) {
        setOpenStreetMapConsent(savedOSM === "true");
      }
    }
  }, []);

  const setCookie = (name: string, value: string, days: number = 365) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  };

  const handleSave = () => {
    if (googleMapsConsent !== null && openStreetMapConsent !== null) {
      // Speichere Zustimmungen in Cookies
      setCookie("cookie_consent_google_maps", googleMapsConsent.toString());
      setCookie("cookie_consent_openstreetmap", openStreetMapConsent.toString());

      // Informiere Parent-Komponente
      onConsentChange({
        googleMaps: googleMapsConsent,
        openStreetMap: openStreetMapConsent,
      });
    }
  };

  const handleAcceptAll = () => {
    setGoogleMapsConsent(true);
    setOpenStreetMapConsent(true);
    setCookie("cookie_consent_google_maps", "true");
    setCookie("cookie_consent_openstreetmap", "true");

    onConsentChange({
      googleMaps: true,
      openStreetMap: true,
    });
  };

  const handleRejectAll = () => {
    setGoogleMapsConsent(false);
    setOpenStreetMapConsent(false);
    setCookie("cookie_consent_google_maps", "false");
    setCookie("cookie_consent_openstreetmap", "false");

    onConsentChange({
      googleMaps: false,
      openStreetMap: false,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-scholle-text mb-4">Zugriff auf externe Server</h2>

        <div className="mb-6 text-scholle-text">
          <p>
            Um Ihnen die bestmögliche Erfahrung zu bieten, verwenden wir externe Kartendienste.
            Bitte wählen Sie aus, welchen Diensten Sie den Zugriff auf externe Server erlauben
            möchten:
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {/* OpenStreetMap Option - ZUERST */}
          <div className="border border-scholle-border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-scholle-text mb-1">
                  OpenStreetMap (Kartenansicht)
                </h3>
                <p className="text-sm text-scholle-text-light mb-2">
                  Ermöglicht die Anzeige von Straßenkarten und Gartenumrissen. Daten werden an
                  OpenStreetMap-Server übertragen.
                </p>
              </div>
              <div className="ml-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openStreetMapConsent === true}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      setOpenStreetMapConsent(newValue);
                      // Wenn OSM deaktiviert wird, deaktiviere auch Google Maps
                      if (!newValue) {
                        setGoogleMapsConsent(false);
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-scholle-border peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-scholle-green-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-scholle-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-scholle-green"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Google Maps Option - ABHÄNGIG VON OSM */}
          <div
            className={`border rounded-lg p-4 transition-colors ${
              openStreetMapConsent === true
                ? "border-scholle-border bg-scholle-bg-container"
                : "border-scholle-border bg-scholle-bg-light"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3
                    className={`font-semibold ${
                      openStreetMapConsent === true
                        ? "text-scholle-text"
                        : "text-scholle-text-light"
                    }`}
                  >
                    Google Maps (3D-Luftbild)
                  </h3>
                  {openStreetMapConsent !== true && (
                    <span className="text-xs text-scholle-text-light bg-scholle-border px-2 py-0.5 rounded">
                      Benötigt OSM
                    </span>
                  )}
                </div>
                <p
                  className={`text-sm mb-2 ${
                    openStreetMapConsent === true
                      ? "text-scholle-text-light"
                      : "text-scholle-text-light"
                  }`}
                >
                  Ermöglicht die Anzeige von hochauflösenden Satellitenbildern und 3D-Geländedaten.
                  Daten werden an Google-Server übertragen.
                </p>
                {openStreetMapConsent !== true && (
                  <p className="text-xs text-orange-600 font-medium mt-1">
                    ⚠️ Google Maps benötigt OpenStreetMap, da die Gartenumrisse aus OSM-Daten
                    stammen.
                  </p>
                )}
              </div>
              <div className="ml-4">
                <label
                  className={`relative inline-flex items-center ${
                    openStreetMapConsent === true
                      ? "cursor-pointer"
                      : "cursor-not-allowed opacity-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={googleMapsConsent === true}
                    disabled={openStreetMapConsent !== true}
                    onChange={(e) => {
                      if (openStreetMapConsent === true) {
                        setGoogleMapsConsent(e.target.checked);
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div
                    className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-scholle-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                      openStreetMapConsent === true
                        ? "bg-scholle-border peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-scholle-green-light peer-checked:bg-scholle-green"
                        : "bg-scholle-border"
                    }`}
                  ></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRejectAll}
            className="flex-1 px-6 py-3 bg-scholle-bg-light text-scholle-text rounded-lg font-medium hover:bg-scholle-border transition-colors border border-scholle-border"
          >
            Alle ablehnen
          </button>
          <button
            onClick={handleSave}
            disabled={googleMapsConsent === null || openStreetMapConsent === null}
            className="flex-1 px-6 py-3 bg-scholle-blue text-white rounded-lg font-medium hover:bg-scholle-blue-dark transition-colors disabled:bg-scholle-border disabled:cursor-not-allowed disabled:text-scholle-text-light"
          >
            Auswahl speichern
          </button>
          <button
            onClick={handleAcceptAll}
            className="flex-1 px-6 py-3 bg-scholle-bg-light text-scholle-text rounded-lg font-medium hover:bg-scholle-border transition-colors border border-scholle-border"
          >
            Alle akzeptieren
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-scholle-border">
          <p className="text-xs text-scholle-text-light text-center">
            <span className="font-semibold">Hinweis:</span> Ihre Auswahl wird in Cookies
            gespeichert, damit Sie diese Seite erneut besuchen können, ohne die Einstellungen erneut
            vornehmen zu müssen. Die Cookies werden für 365 Tage gespeichert.
          </p>
          <p className="text-xs text-scholle-text-light mt-2 text-center">
            Außer dieser Auswahl werden keinerlei Daten gespeichert. Es werden keine
            personenbezogenen Daten im Sinne der DSGVO gespeichert.
          </p>
        </div>
      </div>
    </div>
  );
}
