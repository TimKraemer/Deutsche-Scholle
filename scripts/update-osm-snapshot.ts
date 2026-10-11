/**
 * Erzeugt public/osm-gardens.json aus OpenStreetMap (eine Overpass-Abfrage).
 * Läuft vor jedem Build. Die App lädt diese Datei vom eigenen Server und muss beim
 * Seitenaufruf nicht auf die oft überlasteten Overpass-Server warten.
 *
 * Schlägt die Abfrage fehl, bleibt der vorhandene Snapshot bestehen und der Build läuft weiter.
 */
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fetchGardenDataFromOverpass } from "../src/utils/osm";

const outFile = fileURLToPath(new URL("../public/osm-gardens.json", import.meta.url));

try {
  // overpass-api.de lehnt Anfragen ohne aussagekräftigen User-Agent mit 406 ab
  const data = await fetchGardenDataFromOverpass({
    "User-Agent": "deutsche-scholle-map/1.0 (+https://scholle.tim-kraemer.de)",
  });
  await writeFile(outFile, `${JSON.stringify(data)}\n`);
  const withParcel = Object.values(data.parcels).filter(Boolean).length;
  console.log(
    `OSM-Snapshot aktualisiert: ${data.gardens.length} Gärten, ${withParcel} mit Parzelle`
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
