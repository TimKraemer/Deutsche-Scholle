# 🌱 Kleingartenverein Deutsche Scholle - Interaktive Gartenkarte

Eine moderne Web-Anwendung zur Visualisierung und Verwaltung freier Kleingärten im Verein "Deutsche Scholle" in Osnabrück. Die Anwendung kombiniert OpenStreetMap-Daten mit lokalen Datenbankinformationen, um Interessenten eine intuitive Möglichkeit zu bieten, freie Gärten zu finden und zu erkunden.

## ✨ Was macht diese Anwendung?

Diese Anwendung bietet Mitgliedern und Interessenten des Kleingartenvereins eine interaktive Plattform, um:

- **Freie Gärten auf einer interaktiven Karte entdecken** – Visualisierung aller verfügbaren Gärten mit exakter Position und Umrissen
- **Gärten filtern und sortieren** – Erweiterte Filteroptionen nach Preis, Größe und Verfügbarkeit mit flexibler Sortierung
- **Gartendetails einsehen** – Informationen zu Größe, Parzelle, Verfügbarkeit, Wertermittlung und Ausstattung
- **3D-Satellitenansicht nutzen** – Realistische 3D-Ansicht der Gärten mit Google Maps Integration
- **Gärten durchsuchen** – Schnelle Suche nach Gartennummer mit direkter Navigation
- **Zwischen Gärten navigieren** – Vorheriger/Nächster Navigation auf der Detailseite mit konsistenter Sortierung
- **Checkliste für Neupächter** – Schritt-für-Schritt Anleitung zum Pachten eines Gartens
- **Debug-Tools** – Tabellarischer Vergleich von Datenbank- und OSM-Größen zur Qualitätssicherung

## 🚀 Besondere Merkmale

### 🤖 AI-gestützte Entwicklung
Dieses Projekt wurde **hauptsächlich mit Hilfe von KI-Assistenten** entwickelt und demonstriert, wie moderne AI-Tools bei der Erstellung komplexer Web-Anwendungen unterstützen können. Von der Architekturplanung über die Implementierung bis hin zur Fehlerbehebung – die Entwicklung wurde durch KI-gestützte Pair-Programming-Sessions beschleunigt.

### 🗺️ Intelligente Kartendaten-Integration
Die Anwendung verbindet **OpenStreetMap-Geometriedaten** mit **lokalen Datenbankinformationen** nahtlos. Sie findet automatisch umschließende Parzellen, berechnet Flächen aus OSM-Geometrie und kombiniert diese mit detaillierten Metadaten aus der Vereinsdatenbank.

### 🎯 DSGVO-konformes Cookie-Management
Ein ausgeklügeltes Cookie-Consent-System ermöglicht es Nutzern, präzise zu steuern, welche externen Services (OpenStreetMap, Google Maps) verwendet werden dürfen. Die Anwendung funktioniert auch ohne externe Services, zeigt dann aber eingeschränkte Funktionalität.

### 🎨 Moderne, benutzerfreundliche UI
Das Design orientiert sich am Corporate Design des Vereins und bietet:
- **Responsive Layout** – Funktioniert auf Desktop, Tablet und Smartphone
- **Hover-Synchronisation** – Hover-Effekte zwischen Karte und Liste sind synchronisiert
- **Intelligente Scrollbereiche** – Jeder Bereich scrollt unabhängig, ohne dass die gesamte Seite scrollen muss
- **Minimalistische Icons** – Klare, verständliche Symbole für Ausstattung und Features
- **Erweiterte Filter** – Visuell hervorgehobene Filter mit animiertem Auf-/Zuklappen
- **Sortierbare Tabellen** – Intuitive Sortierung mit visuellen Indikatoren (Pfeile)

### 🔍 Intelligente Parzellenerkennung
Die Anwendung nutzt einen ausgeklügelten Algorithmus, um automatisch die richtige umschließende Parzelle für jeden Garten zu finden – selbst wenn mehrere Ebenen von Parzellen vorhanden sind. Spezifische Parzellen (z.B. "Klostergärten 1") werden dabei bevorzugt vor Vereinsflächen (z.B. "KGV Deutsche Scholle").

### 🎛️ Erweiterte Filter- und Sortierfunktionen
- **Preisfilter** – Min-Max Bereichsslider für Wertermittlung
- **Größenfilter** – Min-Max Bereichsslider für Gartenfläche
- **Verfügbarkeitsfilter** – Checkbox "Nur frei ab sofort"
- **Multi-Sortierung** – Sortierung nach Nummer, Verfügbarkeitsdatum, Größe oder Preis (auf-/absteigend)
- **Persistente Einstellungen** – Filter und Sortierung werden im Browser gespeichert

## 🛠️ Technologie-Stack

- **Frontend Framework**: React 19 mit TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS mit Custom Color Palette
- **Karten**: Leaflet & React-Leaflet für OSM-Karten
- **3D-Visualisierung**: Google Maps API für Satellitenansicht
- **Routing**: React Router DOM
- **Datenquelle**: OpenStreetMap Overpass API
- **Code Quality**: Biome (Linter & Formatter), TypeScript strict mode

## 📋 Features im Detail

### Kartenansicht
- **2D-Kartenansicht** mit OpenStreetMap Tiles
- **3D-Satellitenansicht** mit Google Maps (optional)
- **Interaktive Polygone** für jeden Garten mit Labels
- **Grüne Marker/Labels** für freie Gärten mit Hover-Effekten
- **Labels für alle Gärten** – Zeigt Gartennummern bei hohem Zoom-Level
- **Automatisches Zoomen** – Zeigt alle Gärten auf der Startseite optimal an
- **Gebundene Kartenansicht** – Begrenzt auf Osnabrücker Stadtgebiet
- **Filter-Synchronisation** – Karte zeigt nur gefilterte Gärten als verfügbar

### Gartendetails
- **Basisinformationen**: Nummer, Parzelle, Größe (Datenbank + OSM-berechnet)
- **Verfügbarkeit**: "Frei ab" Datum oder "Sofort"
- **Ausstattung**: Stromanschluss und Wasseranschluss (nur wenn bekannt, Bereich wird ausgeblendet wenn keine Daten)
- **Werte**: Wertermittlung und Wertminderung (Wert wird auch bei 0 angezeigt)
- **Navigation**: Vorheriger/Nächster Garten Buttons mit konsistenter Sortierung
- **Filter-Indikator**: Zeigt an, wenn Filter aktiv sind beim Durchblättern
- **Checkliste**: Schritt-für-Schritt Anleitung für Neupächter

### Suche & Navigation
- **Gartennummer-Suche** mit Fehlerbehandlung
- **Direkte Navigation** zu Gartendetails
- **Sortierbare Liste** nach Nummer, Verfügbarkeitsdatum, Größe oder Preis (mit visuellen Pfeilen)
- **Kompakte Listenansicht** – Übersichtliche Darstellung aller freien Gärten
- **Stand-Datum** – Zeigt Datum der letzten Datenbank-Änderung

## 🎯 Einzigartige Features

1. **Hybride Datenquelle**: Kombiniert OSM-Geometrie mit lokalen Metadaten intelligent
2. **Intelligente Parzellenerkennung**: Findet automatisch die richtige umschließende Parzelle (bevorzugt spezifische Parzellen)
3. **Graceful Degradation**: Funktioniert auch ohne externe Services (mit eingeschränkter Funktionalität)
4. **Cookie-Consent-Management**: Granulare Kontrolle über externe Services
5. **Hover-Synchronisation**: Karte und Liste reagieren synchron auf Hover-Events
6. **Responsive Scrollbereiche**: Jeder Bereich scrollt unabhängig für optimale UX
7. **Erweiterte Filter**: Bereichsslider für Preis und Größe mit persistenter Speicherung
8. **OSM-Ref-Tagging**: Verwendet `ref`-Tag für Gärten statt `name`-Tag für bessere Unterscheidung von Parzellen
9. **Debug-Tools**: Integrierte Debug-Route (`/debug`) für Qualitätssicherung und Datenvergleich
10. **Filter-Synchronisation**: Filter werden zwischen Startseite und Detailseite synchronisiert

## 🚀 Installation & Setup

### Voraussetzungen
- Bun (https://bun.sh)
- Google Maps API Key (optional, für 3D-Satellitenansicht)

### Installation

```bash
# Repository klonen
git clone <repository-url>
cd Deutsche-Scholle

# Dependencies installieren
bun install

# Entwicklungsserver starten
bun run dev
```

### Umgebungsvariablen

Erstelle eine `.env` Datei im Root-Verzeichnis:

```env
VITE_GOOGLE_MAPS_API_KEY=dein-google-maps-api-key
```

### Build für Production

```bash
bun run build
```

Die gebauten Dateien befinden sich im `dist/` Verzeichnis.

## 📁 Projektstruktur

```
src/
├── components/          # React-Komponenten
│   ├── CookieConsent.tsx
│   ├── CookieConsentContent.tsx
│   ├── CookieConsentHint.tsx
│   ├── GardenChecklist.tsx
│   ├── GardenDetails.tsx
│   ├── GardenFilters.tsx
│   ├── GardenList.tsx
│   ├── GardenMap.tsx
│   └── GardenSearch.tsx
├── pages/              # Seiten-Komponenten
│   ├── GardenPage.tsx
│   └── DebugPage.tsx   # Debug-Route für Größenvergleich
├── data/               # Mock-Daten
│   └── mockGardens.ts
├── types/              # TypeScript Typen
│   ├── garden.ts
│   └── cookies.ts
├── utils/              # Utility-Funktionen
│   ├── osm.ts          # OSM API Integration
│   ├── cache.ts        # Caching-Logik
│   ├── cookies.ts      # Cookie-Verwaltung
│   ├── formatting.ts   # Formatierungsfunktionen
│   ├── gardenFilters.ts # Filter-Logik
│   ├── gardenSort.ts  # Sortier-Logik
│   ├── mapHelpers.ts   # Karten-Hilfsfunktionen
│   ├── imageUpscale.ts
│   └── constants.ts    # Konstanten
└── App.tsx             # Hauptkomponente
```

## 🎨 Design-System

Die Anwendung nutzt ein Custom Color Palette basierend auf dem Corporate Design des Vereins:

- **Hintergrund**: `#F3F3F3` (Haupt), `#F7F7F7` (Container)
- **Text**: `#444444` (Haupt), `#666666` (Sekundär)
- **Akzent**: `#6B8F2D` (Grün)
- **Links**: `#0A246A` (Blau)

## 🐛 Debug & Qualitätssicherung

Die Anwendung bietet eine integrierte Debug-Route (`/debug`), die einen tabellarischen Vergleich zwischen Datenbank-Größen und OSM-berechneten Größen ermöglicht. Diese Funktion hilft bei der Qualitätssicherung und Identifikation von Diskrepanzen:

- **Sortierbare Tabelle** – Alle Spalten können sortiert werden
- **Anklickbare Zeilen** – Direkte Navigation zur Detailseite
- **Visuelle Hervorhebung** – Große Abweichungen (>10%) werden hervorgehoben
- **Status-Anzeige** – Zeigt welche Gärten in OSM gefunden wurden

## 📝 Lizenz

Dieses Projekt ist für den internen Gebrauch des Kleingartenvereins Deutsche Scholle bestimmt.

## 🤝 Beitragen

Beiträge sind willkommen! Bitte erstelle einen Issue oder Pull Request für Verbesserungen.

## 📧 Kontakt

Kleingartenverein Deutsche Scholle  
Limbergerstr. 71, 49080 Osnabrück  
Tel.: 0541 / 84840  
E-Mail: info@deutsche-scholle-os.de

**Fehler in der Karte melden**: scholle-map@tk22.de oder direkt beim Verein

---

**Entwickelt mit 🤖 AI-Unterstützung für den Kleingartenverein Deutsche Scholle**

> Dieses Projekt wurde hauptsächlich mit Hilfe von KI-Assistenten entwickelt und zeigt das Potenzial von AI-gestützter Softwareentwicklung für reale Anwendungsfälle.
