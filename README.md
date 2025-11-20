# 🌱 Kleingartenverein Deutsche Scholle - Interaktive Gartenkarte

Eine moderne Web-Anwendung zur Visualisierung und Verwaltung freier Kleingärten im Verein "Deutsche Scholle" in Osnabrück. Die Anwendung kombiniert OpenStreetMap-Daten mit lokalen Datenbankinformationen, um Interessenten eine intuitive Möglichkeit zu bieten, freie Gärten zu finden und zu erkunden.

## ✨ Was macht diese Anwendung?

Diese Anwendung bietet Mitgliedern und Interessenten des Kleingartenvereins eine interaktive Plattform, um:

- **Freie Gärten auf einer interaktiven Karte entdecken** – Visualisierung aller verfügbaren Gärten mit exakter Position und Umrissen
- **Gartendetails einsehen** – Informationen zu Größe, Parzelle, Verfügbarkeit, Wertermittlung und Ausstattung
- **3D-Satellitenansicht nutzen** – Realistische 3D-Ansicht der Gärten mit Google Maps Integration
- **Gärten durchsuchen** – Schnelle Suche nach Gartennummer mit direkter Navigation
- **Checkliste für Neupächter** – Schritt-für-Schritt Anleitung zum Pachten eines Gartens

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

### 🔍 Intelligente Parzellenerkennung
Die Anwendung nutzt einen ausgeklügelten Algorithmus, um automatisch die richtige umschließende Parzelle für jeden Garten zu finden – selbst wenn mehrere Ebenen von Parzellen vorhanden sind.

## 🛠️ Technologie-Stack

- **Frontend Framework**: React 19 mit TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS mit Custom Color Palette
- **Karten**: Leaflet & React-Leaflet für OSM-Karten
- **3D-Visualisierung**: Google Maps API für Satellitenansicht
- **Routing**: React Router DOM
- **Datenquelle**: OpenStreetMap Overpass API
- **Code Quality**: ESLint, TypeScript strict mode

## 📋 Features im Detail

### Kartenansicht
- **2D-Kartenansicht** mit OpenStreetMap Tiles
- **3D-Satellitenansicht** mit Google Maps (optional)
- **Interaktive Polygone** für jeden Garten mit Labels
- **Marker für freie Gärten** mit Hover-Effekten
- **Automatisches Zoomen** auf ausgewählte Gärten

### Gartendetails
- **Basisinformationen**: Nummer, Parzelle, Größe (Datenbank + OSM-berechnet)
- **Verfügbarkeit**: "Frei ab" Datum oder "Sofort"
- **Ausstattung**: Stromanschluss und Wasseranschluss (nur wenn bekannt)
- **Werte**: Wertermittlung und Wertminderung
- **Checkliste**: Schritt-für-Schritt Anleitung für Neupächter

### Suche & Navigation
- **Gartennummer-Suche** mit Fehlerbehandlung
- **Direkte Navigation** zu Gartendetails
- **Sortierbare Liste** nach Nummer oder Verfügbarkeitsdatum

## 🎯 Einzigartige Features

1. **Hybride Datenquelle**: Kombiniert OSM-Geometrie mit lokalen Metadaten intelligent
2. **Intelligente Parzellenerkennung**: Findet automatisch die richtige umschließende Parzelle
3. **Graceful Degradation**: Funktioniert auch ohne externe Services (mit eingeschränkter Funktionalität)
4. **Cookie-Consent-Management**: Granulare Kontrolle über externe Services
5. **Hover-Synchronisation**: Karte und Liste reagieren synchron auf Hover-Events
6. **Responsive Scrollbereiche**: Jeder Bereich scrollt unabhängig für optimale UX

## 🚀 Installation & Setup

### Voraussetzungen
- Node.js 18+ und npm
- Google Maps API Key (optional, für 3D-Satellitenansicht)

### Installation

```bash
# Repository klonen
git clone <repository-url>
cd Deutsche-Scholle

# Dependencies installieren
npm install

# Entwicklungsserver starten
npm run dev
```

### Umgebungsvariablen

Erstelle eine `.env` Datei im Root-Verzeichnis:

```env
VITE_GOOGLE_MAPS_API_KEY=dein-google-maps-api-key
```

### Build für Production

```bash
npm run build
```

Die gebauten Dateien befinden sich im `dist/` Verzeichnis.

## 📁 Projektstruktur

```
src/
├── components/          # React-Komponenten
│   ├── CookieConsent.tsx
│   ├── GardenChecklist.tsx
│   ├── GardenDetails.tsx
│   ├── GardenList.tsx
│   ├── GardenMap.tsx
│   └── GardenSearch.tsx
├── pages/              # Seiten-Komponenten
│   └── GardenPage.tsx
├── data/               # Mock-Daten
│   └── mockGardens.ts
├── types/              # TypeScript Typen
│   └── garden.ts
├── utils/              # Utility-Funktionen
│   ├── osm.ts          # OSM API Integration
│   ├── cache.ts        # Caching-Logik
│   └── imageUpscale.ts
└── App.tsx             # Hauptkomponente
```

## 🎨 Design-System

Die Anwendung nutzt ein Custom Color Palette basierend auf dem Corporate Design des Vereins:

- **Hintergrund**: `#F3F3F3` (Haupt), `#F7F7F7` (Container)
- **Text**: `#444444` (Haupt), `#666666` (Sekundär)
- **Akzent**: `#6B8F2D` (Grün)
- **Links**: `#0A246A` (Blau)

## 📝 Lizenz

Dieses Projekt ist für den internen Gebrauch des Kleingartenvereins Deutsche Scholle bestimmt.

## 🤝 Beitragen

Beiträge sind willkommen! Bitte erstelle einen Issue oder Pull Request für Verbesserungen.

## 📧 Kontakt

Kleingartenverein Deutsche Scholle  
Limbergerstr. 71, 49080 Osnabrück  
Tel.: 0541 / 84840  
E-Mail: info@deutsche-scholle-os.de

---

**Entwickelt mit 🤖 AI-Unterstützung für den Kleingartenverein Deutsche Scholle**

> Dieses Projekt wurde hauptsächlich mit Hilfe von KI-Assistenten entwickelt und zeigt das Potenzial von AI-gestützter Softwareentwicklung für reale Anwendungsfälle.
