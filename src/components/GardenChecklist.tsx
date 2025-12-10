import type { Garden } from "../types/garden";

interface GardenChecklistProps {
  garden: Garden;
}

export default function GardenChecklist({ garden }: GardenChecklistProps) {
  // Prüfe ob Garten frei ist
  const isAvailable = garden.availableFrom && garden.availableFrom.trim() !== "";

  if (!isAvailable) {
    return null;
  }

  const steps = [
    {
      id: 1,
      title: "Sprechstunde besuchen",
      description: "Jeden 2. und 4. Dienstag im Monat, 18:00-20:00 Uhr",
      location: "Büro im Vereinshaus, Limbergerstr. 71",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      id: 2,
      title: "Garten zugewiesen bekommen",
      description: "Der Vorstand weist Ihnen einen freien Garten zu",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: 3,
      title: "Wertermittlungsprotokoll einsehen",
      description: "Das Protokoll stellt die Obergrenze der Ablösesumme dar",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      id: 4,
      title: "FED-Versicherung abschließen",
      description: "Feuer-Einbruch-Diebstahlversicherung erforderlich",
      location: "Bei der 2. Kassiererin an den Sprechtagen",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
    {
      id: 5,
      title: "Garten übernehmen",
      description: "Gartenübernahme mit Vorstand und Vorbesitzer",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
    {
      id: 6,
      title: "Gartenfachberater kontaktieren",
      description: "Kostenlose Beratung bei der Anlage des Gartens",
      advisors: "Klaus Irek, Uwe Schmidt, Margret Schmidt",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      id: 7,
      title: "Gemeinschaftsarbeit beachten",
      description: "8 Stunden pro Jahr verpflichtend",
      note: "Bei Nichtteilnahme: 15 € pro Stunde",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="mt-6 pt-6 border-t border-scholle-border">
      <h3 className="text-xl font-bold text-scholle-text mb-4">Der Weg zum eigenen Garten</h3>
      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex items-start gap-4 p-4 bg-scholle-bg-light rounded-lg border border-scholle-border hover:border-scholle-green transition-colors"
          >
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-scholle-green text-white flex items-center justify-center font-bold text-sm">
                {step.id}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3 mb-1">
                <div className="flex-shrink-0 mt-1 text-scholle-green">{step.icon}</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-scholle-text mb-1">{step.title}</h4>
                  <p className="text-sm text-scholle-text-light">{step.description}</p>
                  {step.location && (
                    <p className="text-xs text-scholle-text-light mt-1 italic">{step.location}</p>
                  )}
                  {step.advisors && (
                    <p className="text-xs text-scholle-text-light mt-1">
                      <span className="font-medium">Berater:</span> {step.advisors}
                    </p>
                  )}
                  {step.note && (
                    <p className="text-xs text-yellow-700 mt-1 font-medium">{step.note}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Kontakt & Formulare</h4>
            <p className="text-sm text-blue-800 mb-2">
              <strong>Vereinshaus:</strong> Limbergerstr. 71, 49080 Osnabrück
              <br />
              <strong>Tel.:</strong> 0541 / 84840
              <br />
              <strong>E-Mail:</strong>{" "}
              <a
                href="mailto:info@deutsche-scholle-os.de"
                className="underline hover:text-blue-900"
              >
                info@deutsche-scholle-os.de
              </a>
            </p>
            <a
              href="https://www.deutsche-scholle-os.de/abteilung3/formulare-download/index.php"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-900 hover:text-blue-700 underline"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Formulare herunterladen
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
