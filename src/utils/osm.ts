import type { Garden } from "../types/garden";
import { CacheKeys, clearExpiredCache, getFromCache, setCache } from "./cache";

// Overpass API Server (Fallback-Reihenfolge)
// Nur Server, die die Abfrage zuverlässig beantworten. kumi.systems, openstreetmap.ru und
// openstreetmap.fr lieferten 500er, hingen 40s+ oder waren nicht erreichbar und haben die
// Ladezeit massiv in die Länge gezogen.
const OVERPASS_API_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// Bounding Box Osnabrück (south,west,north,east)
const OSNABRUECK_BBOX = "52.2,7.9,52.35,8.15";

// Vom Build erzeugter Snapshot (scripts/update-osm-snapshot.ts), liegt auf dem eigenen Server
const SNAPSHOT_URL = "/osm-gardens.json";

// Ab diesem Alter wird im Hintergrund einmal bei Overpass nachgefragt
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;

// Aktualisierte Daten bleiben im localStorage, bis ein neuerer Snapshot kommt
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface OSMWay {
  type: "way";
  id: number;
  nodes?: number[];
  geometry?: Array<{ lat: number; lon: number }>;
  tags: {
    [key: string]: string;
  };
  // Geländehöhe des Gartenmittelpunkts in m über NN (vom Build-Skript ergänzt, für die 3D-Kamera)
  elevation?: number;
}

interface OSMResponse {
  elements: OSMWay[];
}

/**
 * Alle Daten, die die App aus OSM braucht: Gärten mit Umriss und die umschließende
 * Parzelle je Garten (vorab berechnet, damit dafür keine eigene Abfrage nötig ist).
 */
export interface GardenData {
  generatedAt: number;
  gardens: OSMWay[];
  // OSM Way ID des Gartens → Name der Parzelle bzw. Vereinsfläche
  parcels: Record<string, string | null>;
}

/**
 * Führt einen Overpass API Request mit Retry-Logik und Fallback-Servern aus
 *
 * Warum Retry-Logik und Fallback-Server?
 * - Overpass API Server können temporär überlastet sein (504/503 Fehler)
 * - Einzelne Server können ausfallen
 * - Exponential Backoff verhindert Server-Überlastung bei Retries
 *
 * @param query Die Overpass Query
 * @param headers Zusätzliche Header (z.B. User-Agent im Build-Skript, ohne den overpass-api.de 406 liefert)
 */
async function fetchOverpassAPI(
  query: string,
  headers: Record<string, string> = {}
): Promise<Response> {
  const maxRetries = 2;
  const retryDelay = 2000;
  let lastError: Error | null = null;

  for (const serverUrl of OVERPASS_API_SERVERS) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(serverUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...headers,
          },
          body: `data=${encodeURIComponent(query)}`,
          // Query-Timeout ist 25s, danach hängt der Server nur noch
          signal: AbortSignal.timeout(30000),
        });

        if (response.ok) {
          return response;
        }

        lastError = new Error(`Overpass API error: ${response.status} ${response.statusText}`);

        // Temporäre Fehler mit Retry + Backoff behandeln:
        // - 429 Too Many Requests: Rate-Limit (Overpass hat strikte Limits)
        // - 503 Service Unavailable / 504 Gateway Timeout: temporäre Überlastung
        const isTransient =
          response.status === 429 || response.status === 503 || response.status === 504;

        if (isTransient && attempt < maxRetries - 1) {
          // Respektiere Retry-After Header (Sekunden), sonst Exponential Backoff.
          const retryAfter = Number(response.headers.get("Retry-After"));
          const backoff = retryDelay * 2 ** attempt;
          const delay =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter, 10) * 1000
              : backoff;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Retries erschöpft oder nicht-temporärer Fehler: nächsten Server versuchen
        break;
      } catch (error: any) {
        // Timeout oder Netzwerkfehler: nicht am selben Server weiterwarten
        lastError = error;
        break;
      }
    }
  }

  throw lastError || new Error("Overpass API: All servers failed");
}

function getBounds(geometry: Array<{ lat: number; lon: number }>) {
  const lats = geometry.map((p) => p.lat);
  const lons = geometry.map((p) => p.lon);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  };
}

/**
 * Findet die umschließende Parzelle für einen Garten
 * Kandidaten sind Ways mit Namen:
 * - landuse=allotments (Vereinsflächen wie "KGV Deutsche Scholle")
 * - allotments=allotments oder allotments=site (alternative Tagging-Varianten)
 * - allotments=plot mit name (Parzellen wie "Klostergärten 1")
 *
 * Die Hierarchie ist: Verein (landuse=allotments) > Parzelle (allotments=plot mit name) > Garten (allotments=plot mit ref)
 */
function pickEnclosingParcel(gardenWay: OSMWay, candidates: OSMWay[]): string | null {
  if (!gardenWay.geometry || gardenWay.geometry.length === 0) {
    return null;
  }

  const { minLat, maxLat, minLon, maxLon } = getBounds(gardenWay.geometry);

  // Nur Kandidaten in der Nähe betrachten (Bounds des Gartens + ~100m)
  const searchMargin = 0.001;
  const nearby = candidates.filter((element) => {
    if (!element.geometry || element.geometry.length === 0) {
      return false;
    }
    const b = getBounds(element.geometry);
    return (
      b.maxLat >= minLat - searchMargin &&
      b.minLat <= maxLat + searchMargin &&
      b.maxLon >= minLon - searchMargin &&
      b.minLon <= maxLon + searchMargin
    );
  });

  if (nearby.length === 0) {
    return null;
  }

  const gardenCenter = {
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
  };
  const gardenWayId = gardenWay.id;
  const gardenArea = (maxLat - minLat) * (maxLon - minLon); // Ungefähre Fläche des Gartens

  const elementsWithArea = nearby.map((element) => {
    const b = getBounds(element.geometry ?? []);
    return { element, area: (b.maxLat - b.minLat) * (b.maxLon - b.minLon) };
  });

  // Filtere: Ausschluss des Gartens selbst
  // Behalte:
  // - Elemente mit landuse=allotments (Vereinsflächen wie "KGV Deutsche Scholle")
  // - Elemente mit allotments=allotments oder allotments=site (übergeordnete Parzellen)
  // - Elemente mit allotments=plot die deutlich größer sind als der Garten (mindestens 2x) - das sind Parzellen wie "Klostergärten 1"
  // - Elemente ohne allotments Tag die deutlich größer sind (könnten Parzellen sein)
  const filteredElements = elementsWithArea.filter(({ element, area }) => {
    if (element.id === gardenWayId) {
      return false;
    }

    const landuseTag = element.tags?.landuse;
    const allotmentsTag = element.tags?.allotments;

    if (landuseTag === "allotments") {
      return true;
    }

    if (allotmentsTag === "allotments" || allotmentsTag === "site") {
      return true;
    }

    if (allotmentsTag === "plot") {
      return area > gardenArea * 2;
    }

    if (element.tags?.highway) {
      return false;
    }

    return area > gardenArea * 3; // Höhere Schwelle für unbekannte Tags
  });

  // Priorisiere spezifische Parzellen (allotments=plot mit Namen) über Vereinsflächen (landuse=allotments)
  filteredElements.sort((a, b) => {
    const aIsParcel = a.element.tags?.allotments === "plot" && a.element.tags?.name;
    const bIsParcel = b.element.tags?.allotments === "plot" && b.element.tags?.name;
    const aIsVerein = a.element.tags?.landuse === "allotments";
    const bIsVerein = b.element.tags?.landuse === "allotments";

    if (aIsParcel && !bIsParcel) return -1;
    if (!aIsParcel && bIsParcel) return 1;

    if (aIsVerein && !bIsVerein) return 1;
    if (!aIsVerein && bIsVerein) return -1;

    // Ansonsten nach Fläche sortieren (kleinere Parzellen zuerst, da spezifischer)
    return a.area - b.area;
  });

  // Finde die Parzelle, die den Garten umschließt. Durch die Sortierung werden spezifische
  // Parzellen zuerst geprüft, Vereinsflächen kommen zuletzt.
  let vereinFallback: string | null = null;

  for (const { element } of filteredElements) {
    if (element.geometry && isPointInPolygon(gardenCenter, element.geometry)) {
      // Vereinsfläche als Fallback merken, aber weiter nach spezifischeren Parzellen suchen
      if (element.tags?.landuse === "allotments" && element.tags?.name) {
        vereinFallback = element.tags.name;
        continue;
      }

      if (element.tags?.name) {
        return element.tags.name;
      }
    }
  }

  if (vereinFallback) {
    return vereinFallback;
  }

  // Fallback: größtes Polygon, das den Garten umschließt
  let largestEnclosing: { element: OSMWay; area: number } | null = null;

  for (const { element, area } of elementsWithArea) {
    if (element.id === gardenWayId) continue;

    if (element.geometry && isPointInPolygon(gardenCenter, element.geometry)) {
      if (!largestEnclosing || area > largestEnclosing.area) {
        largestEnclosing = { element, area };
      }
    }
  }

  if (largestEnclosing?.element.tags?.name) {
    return largestEnclosing.element.tags.name;
  }

  // Fallback: Nimm die erste Parzelle mit Name in der Nähe
  return nearby.find((el) => el.tags?.name)?.tags.name || null;
}

/**
 * Einfache Punkt-in-Polygon-Prüfung
 */
function isPointInPolygon(
  point: { lat: number; lon: number },
  polygon: Array<{ lat: number; lon: number }>
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon;
    const yi = polygon[i].lat;
    const xj = polygon[j].lon;
    const yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Holt Gärten und Parzellen mit EINER Overpass-Abfrage und berechnet die Parzelle je Garten.
 * Wird vom Build-Skript (Snapshot) und von der Hintergrund-Aktualisierung genutzt.
 *
 * Gärten: allotments=plot mit ref (Gartennummer)
 * Parzellen-Kandidaten: alles mit name (Vereinsflächen, benannte Parzellen)
 */
export async function fetchGardenDataFromOverpass(
  headers: Record<string, string> = {}
): Promise<GardenData> {
  const query = `
    [out:json][timeout:25];
    (
      way["allotments"="plot"]["ref"](${OSNABRUECK_BBOX});
      way["landuse"="allotments"]["name"](${OSNABRUECK_BBOX});
      way["allotments"~"^(allotments|site|plot)$"]["name"](${OSNABRUECK_BBOX});
    );
    out geom;
  `;

  const response = await fetchOverpassAPI(query, headers);
  const data: OSMResponse = await response.json();
  const elements = data.elements || [];

  const gardens = elements
    .filter((el) => el.tags?.allotments === "plot" && el.tags?.ref)
    // nodes und bounds werden nicht gebraucht, spart Platz im Snapshot und localStorage
    .map(({ type, id, geometry, tags }) => ({ type, id, geometry, tags }));
  const candidates = elements.filter((el) => el.tags?.name);

  // Leere Antwort nie als gültigen Stand übernehmen
  if (gardens.length === 0) {
    throw new Error("Overpass API: keine Gärten in der Antwort");
  }

  const parcels: Record<string, string | null> = {};
  for (const garden of gardens) {
    parcels[garden.id] = pickEnclosingParcel(garden, candidates);
  }

  return { generatedAt: Date.now(), gardens, parcels };
}

let dataPromise: Promise<GardenData> | null = null;
// Zuletzt geladener Stand, um Geländehöhen bei einer Aktualisierung zu übernehmen
let currentData: GardenData | null = null;
let refreshPromise: Promise<GardenData> | null = null;
const listeners = new Set<(data: GardenData) => void>();

async function fetchSnapshot(): Promise<GardenData | null> {
  try {
    const response = await fetch(SNAPSHOT_URL);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as GardenData;
  } catch {
    return null;
  }
}

async function loadInitialGardenData(): Promise<GardenData> {
  // Räumt auch Einträge früherer Versionen auf (Einzelgärten, Parzellen)
  clearExpiredCache();
  const cached = getFromCache<GardenData>(CacheKeys.GARDEN_DATA);
  const snapshot = await fetchSnapshot();

  // Den neueren Stand verwenden: Snapshot vom letzten Deploy oder Hintergrund-Aktualisierung
  if (snapshot && (!cached || snapshot.generatedAt >= cached.generatedAt)) {
    return snapshot;
  }
  if (cached) {
    return cached;
  }

  // Weder Snapshot noch Cache (sollte nicht vorkommen): direkt bei Overpass laden
  return refreshGardenData();
}

/**
 * Liefert die Gartendaten. Lädt sie nur einmal pro Seitenaufruf, alle Komponenten teilen
 * sich das Ergebnis. Quelle ist der Snapshot vom eigenen Server (schnell, keine Abhängigkeit
 * von Overpass). Ist der Stand älter als REFRESH_AFTER_MS, wird im Hintergrund aktualisiert.
 */
export function getGardenData(): Promise<GardenData> {
  if (!dataPromise) {
    const promise = loadInitialGardenData();
    dataPromise = promise;
    promise
      .then((data) => {
        currentData = data;
        if (Date.now() - data.generatedAt > REFRESH_AFTER_MS) {
          refreshGardenData().catch((error) => {
            console.warn("Hintergrund-Aktualisierung der OSM-Daten fehlgeschlagen:", error);
          });
        }
      })
      .catch(() => {
        // Beim nächsten Aufruf erneut versuchen
        if (dataPromise === promise) {
          dataPromise = null;
        }
      });
  }
  return dataPromise;
}

/**
 * Holt frische Daten von Overpass, speichert sie im Cache und benachrichtigt alle Abonnenten.
 */
export function refreshGardenData(): Promise<GardenData> {
  if (!refreshPromise) {
    refreshPromise = fetchGardenDataFromOverpass()
      .then((data) => {
        // Overpass liefert keine Höhen, die aus dem Snapshot übernehmen
        const previousElevations = new Map(
          (currentData?.gardens ?? []).map((g) => [g.id, g.elevation])
        );
        for (const garden of data.gardens) {
          garden.elevation = previousElevations.get(garden.id);
        }
        currentData = data;
        setCache(CacheKeys.GARDEN_DATA, data, CACHE_TTL_MS);
        dataPromise = Promise.resolve(data);
        for (const listener of listeners) {
          listener(data);
        }
        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * Benachrichtigt bei neuen Daten aus der Hintergrund-Aktualisierung.
 * @returns Funktion zum Abmelden
 */
export function subscribeGardenData(listener: (data: GardenData) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Sucht einen Garten anhand der Gartennummer (OSM-Tag ref)
 */
export function findOsmGarden(data: GardenData, gardenNumber: string): OSMWay | null {
  return data.gardens.find((g) => g.tags.ref === gardenNumber) ?? null;
}

/**
 * Berechnet die Fläche eines Polygons in m² (sphärische Fläche nach Gauss)
 * Verwendet die Formel für die Fläche eines Polygons auf einer Kugeloberfläche
 */
function calculatePolygonArea(geometry: Array<{ lat: number; lon: number }>): number {
  if (geometry.length < 3) {
    return 0;
  }

  const R = 6371000; // Erdradius in Metern
  let area = 0;

  // Stelle sicher, dass das Polygon geschlossen ist
  const coords = [...geometry];
  if (
    coords[0].lat !== coords[coords.length - 1].lat ||
    coords[0].lon !== coords[coords.length - 1].lon
  ) {
    coords.push(coords[0]);
  }

  // Berechne die Fläche mit der sphärischen Exzess-Formel
  for (let i = 0; i < coords.length - 1; i++) {
    const j = (i + 1) % (coords.length - 1);

    const lat1 = (coords[i].lat * Math.PI) / 180;
    const lon1 = (coords[i].lon * Math.PI) / 180;
    const lat2 = (coords[j].lat * Math.PI) / 180;
    const lon2 = (coords[j].lon * Math.PI) / 180;

    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = Math.abs((area * R * R) / 2);

  // Wenn die Berechnung zu klein ist, versuche eine einfachere Approximation
  if (area < 1) {
    // Berechne Bounding Box und verwende als Approximation
    const lats = geometry.map((p) => p.lat);
    const lons = geometry.map((p) => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // Näherung: Rechteckfläche in m²
    const latDiff = ((maxLat - minLat) * Math.PI) / 180;
    const lonDiff = ((maxLon - minLon) * Math.PI) / 180;
    const avgLat = (((minLat + maxLat) / 2) * Math.PI) / 180;

    area = R * R * latDiff * lonDiff * Math.cos(avgLat);
  }

  return Math.round(area);
}

/**
 * Konvertiert OSM Way zu Garden-Format
 * @param osmWay Der OSM Way für den Garten
 * @param listData Optionale Daten aus der Vereinsliste der freien Gärten
 * @param enclosingParcel Die umschließende Parzelle aus OSM (optional)
 */
export function osmWayToGarden(
  osmWay: OSMWay,
  listData?: Partial<Garden>,
  enclosingParcel?: string | null
): Garden | null {
  if (!osmWay.geometry || osmWay.geometry.length === 0) {
    return null;
  }

  // Berechne Zentrum der Geometrie
  const centerLat =
    osmWay.geometry.reduce((sum, point) => sum + point.lat, 0) / osmWay.geometry.length;
  const centerLon =
    osmWay.geometry.reduce((sum, point) => sum + point.lon, 0) / osmWay.geometry.length;

  // Berechne Bounds
  const lats = osmWay.geometry.map((p) => p.lat);
  const lons = osmWay.geometry.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Berechne Fläche aus OSM-Geometrie
  const calculatedSize = calculatePolygonArea(osmWay.geometry);

  // Verwende umschließende Parzelle aus OSM, falls vorhanden, sonst Mock-Daten
  const parcel = enclosingParcel || listData?.parcel || "";

  return {
    id: `garden-${osmWay.id}`,
    number: osmWay.tags.ref || "", // ref ist das Standard-Tag für Gartennummern
    parcel: parcel,
    size: listData?.size || 0, // Datenbank-Größe
    osmSize: calculatedSize, // OSM-Größe (immer setzen, auch wenn 0)
    availableFrom: listData?.availableFrom || "",
    valuation: listData?.valuation || 0,
    valueReduction: listData?.valueReduction || 0,
    hasElectricity: listData?.hasElectricity, // Optional: nur wenn bekannt
    waterConnection: listData?.waterConnection, // Optional: nur wenn bekannt
    coordinates: [centerLat, centerLon] as [number, number],
    bounds: [
      [minLat, minLon],
      [maxLat, maxLon],
    ] as [[number, number], [number, number]],
    osmWayId: osmWay.id,
  };
}

/**
 * Konvertiert OSM Geometrie zu Leaflet Polygon-Koordinaten
 */
export function osmGeometryToLeafletCoords(
  geometry: Array<{ lat: number; lon: number }>
): [number, number][] {
  return geometry.map((point) => [point.lat, point.lon]);
}
