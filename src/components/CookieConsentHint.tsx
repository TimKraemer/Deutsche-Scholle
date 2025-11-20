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
    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-[1000]">
      <div 
        className="text-center p-6 bg-white rounded-lg shadow-lg max-w-md cursor-pointer hover:shadow-xl transition-shadow"
        onClick={onOpenCookieConsent}
      >
        <p className="text-gray-700 mb-2">
          Um {feature} zu nutzen, benötigen wir Ihre Zustimmung für {getServicesText()}.
        </p>
        {requiredServices.length > 1 && (
          <p className="text-sm text-gray-600 mb-2">
            Die 3D-Luftbildansicht benötigt sowohl OpenStreetMap-Daten für die Gartenumrisse als auch Google Maps für die Satellitenbilder.
          </p>
        )}
        <p className="text-sm text-blue-600 font-medium">
          Klicken Sie hier, um die Cookie-Einstellungen zu öffnen.
        </p>
      </div>
    </div>
  );
}

