/**
 * Erzeugt public/osm-gardens.json aus OpenStreetMap (eine Overpass-Abfrage).
 * Läuft vor jedem Build. Die App lädt diese Datei vom eigenen Server und muss beim
 * Seitenaufruf nicht auf die oft überlasteten Overpass-Server warten.
 *
 * Zusätzlich wird pro Garten die Geländehöhe von Open-Meteo ergänzt. Die 3D-Ansicht braucht
 * sie, um die Kamera auf den Garten statt auf einen Punkt unter der Erde zu richten.
 *
 * Schlägt die Abfrage fehl, bleibt der vorhandene Snapshot bestehen und der Build läuft weiter.
 */
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { calculateGeometryCenter } from "../src/utils/mapHelpers";
import { fetchGardenDataFromOverpass, type GardenData, type OSMWay } from "../src/utils/osm";

const outFile = fileURLToPath(new URL("../public/osm-gardens.json", import.meta.url));

// Open-Meteo erlaubt bis zu 100 Koordinaten pro Anfrage
const ELEVATION_BATCH_SIZE = 100;

async function addElevations(gardens: OSMWay[], previous: GardenData | null): Promise<number> {
  const previousElevations = new Map((previous?.gardens ?? []).map((g) => [g.id, g.elevation]));
  let fetched = 0;

  for (let i = 0; i < gardens.length; i += ELEVATION_BATCH_SIZE) {
    const batch = gardens.slice(i, i + ELEVATION_BATCH_SIZE);
    const centers = batch.map((g) => calculateGeometryCenter(g.geometry ?? []));
    const valid = batch.filter((_, j) => centers[j] !== null);
    const points = centers.filter((c) => c !== null);

    try {
      const latitudes = points.map((c) => c.lat.toFixed(6)).join(",");
      const longitudes = points.map((c) => c.lon.toFixed(6)).join(",");
      const response = await fetch(
        `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`,
        { signal: AbortSignal.timeout(20000) }
      );
      if (!response.ok) {
        throw new Error(`Open-Meteo error: ${response.status}`);
      }
      const { elevation } = (await response.json()) as { elevation: number[] };
      valid.forEach((garden, j) => {
        garden.elevation = elevation[j];
      });
      fetched += valid.length;
    } catch (error) {
      console.warn(
        `Geländehöhen nicht geladen (${error instanceof Error ? error.message : error}), nutze vorherige Werte.`
      );
      for (const garden of batch) {
        garden.elevation = previousElevations.get(garden.id);
      }
    }
  }

  return fetched;
}

function readPreviousSnapshot(): GardenData | null {
  try {
    return JSON.parse(readFileSync(outFile, "utf8")) as GardenData;
  } catch {
    return null;
  }
}

try {
  // overpass-api.de lehnt Anfragen ohne aussagekräftigen User-Agent mit 406 ab
  const data = await fetchGardenDataFromOverpass({
    "User-Agent": "deutsche-scholle-map/1.0 (+https://scholle.tim-kraemer.de)",
  });
  const withElevation = await addElevations(data.gardens, readPreviousSnapshot());
  await writeFile(outFile, `${JSON.stringify(data)}\n`);
  const withParcel = Object.values(data.parcels).filter(Boolean).length;
  console.log(
    `OSM-Snapshot aktualisiert: ${data.gardens.length} Gärten, ${withParcel} mit Parzelle, ${withElevation} mit neu geladener Höhe`
  );
} catch (error) {
  if (!existsSync(outFile)) {
    console.error("OSM-Snapshot konnte nicht erstellt werden:", error);
    process.exit(1);
  }
  console.warn(
    `OSM-Snapshot nicht aktualisiert (${error instanceof Error ? error.message : error}), vorhandene Datei bleibt.`
  );
}
