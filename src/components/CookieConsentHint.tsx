interface CookieConsentHintProps {
  service?: 'Google Maps' | 'OpenStreetMap';
  services?: ('Google Maps' | 'OpenStreetMap')[];
  feature: string;
  onOpenCookieConsent?: () => void;
}

export default function CookieConsentHint({ service, services, feature, onOpenCookieConsent }: CookieConsentHintProps) {
  // Bestimme welche Services benötigt werden
  const requiredServices = services || (service ? [service] : []);
  
  // Erstelle Text für benötigte Services
  const getServicesText = () => {
    if (requiredServices.length === 0) {
      return 'die benötigten Dienste';
    } else if (requiredServices.length === 1) {
      return requiredServices[0];
    } else if (requiredServices.length === 2) {
      return `${requiredServices[0]} und ${requiredServices[1]}`;
    } else {
      return requiredServices.join(', ');
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-scholle-bg-light z-[1000]">
      <div 
        className="text-center p-6 bg-scholle-bg-container rounded-lg shadow-lg max-w-md cursor-pointer hover:shadow-xl transition-shadow border border-scholle-border"
        onClick={onOpenCookieConsent}
      >
        <p className="text-scholle-text mb-3 text-base">
          Um {feature} zu nutzen, benötigen wir Ihre Zustimmung für {getServicesText()}.
        </p>
        {requiredServices.length > 1 && (
          <p className="text-scholle-text-light mb-3 text-base">
            Die 3D-Luftbildansicht benötigt sowohl OpenStreetMap-Daten für die Gartenumrisse als auch Google Maps für die Satellitenbilder.
          </p>
        )}
        <p className="text-scholle-blue font-medium text-base hover:text-scholle-blue-dark transition-colors">
          Klicken Sie hier, um die Cookie-Einstellungen zu öffnen.
        </p>
      </div>
    </div>
  );
}

