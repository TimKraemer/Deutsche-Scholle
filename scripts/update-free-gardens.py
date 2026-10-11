#!/usr/bin/env python3
"""
Holt die Liste der freien Gärten von der Vereinsseite und schreibt sie als JSON.

Aufruf: update-free-gardens.py [Zieldatei]   (Standard: public/freie-gaerten.json)

Die Vereinsseite baut ihre Tabelle per JavaScript aus einem Array im HTML
(W2DPluginTable, `var cellsN = [...]` mit Spaltenköpfen in `var colsN`). Das Skript
liest dieses Array aus und speichert Spaltenköpfe und Zeilen unverändert als Text.
Die Umwandlung in Gartendaten übernimmt die App (src/utils/freeGardens.ts).

Läuft beim Build und per Cron auf dem Server, dort gibt es nur Python 3 (kein Bun/Node),
deshalb hier nur Standardbibliothek. Schlägt der Abruf fehl, bleibt die vorhandene Datei
unverändert.

`changedAt` ist das Datum, an dem sich die Liste zuletzt geändert hat. Die Vereinsseite
nennt selbst keinen Stand, deshalb wird es beim Vergleich mit der vorherigen Datei gesetzt.
"""

import json
import os
import re
import sys
import tempfile
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

SOURCE_URL = "https://www.deutsche-scholle-os.de/freie-gaerten/index.php"
USER_AGENT = "deutsche-scholle-map/1.0 (+https://scholle.tim-kraemer.de)"
REQUIRED_COLUMNS = {"Nr.", "Parzelle", "Größe", "frei ab", "Wertermittlung", "Wertminderung"}
DEFAULT_OUT = Path(__file__).resolve().parent.parent / "public" / "freie-gaerten.json"

ARRAY_PATTERN = r"var\s+{name}(\d*)\s*=\s*(\[.*?\])\s*;"


def fetch_page() -> str:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read()
    # Die Seite ist als ISO-8859-1 deklariert, das €-Zeichen kommt aber als cp1252-Byte 0x80
    return raw.decode("cp1252", errors="replace")


def extract_table(html: str) -> tuple[list[str], list[list[str]]]:
    """Findet die Tabelle mit den Spalten der freien Gärten und gibt Köpfe und Zeilen zurück."""
    rows_by_index = {
        m.group(1): m.group(2) for m in re.finditer(ARRAY_PATTERN.format(name="cells"), html, re.S)
    }
    for match in re.finditer(ARRAY_PATTERN.format(name="cols"), html, re.S):
        index = match.group(1)
        columns = [col[0].strip() for col in json.loads(match.group(2))]
        if REQUIRED_COLUMNS.issubset(columns) and index in rows_by_index:
            rows = json.loads(rows_by_index[index])
            if any(len(row) != len(columns) for row in rows):
                raise ValueError("Zeilen passen nicht zu den Spaltenköpfen")
            return columns, [[str(cell).strip() for cell in row] for row in rows]
    raise ValueError("Tabelle der freien Gärten nicht gefunden")


def read_previous(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def write_atomic(path: Path, content: str) -> None:
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        # mkstemp legt 0600 an, nginx muss die Datei lesen können
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise


def main() -> int:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    previous = read_previous(out)

    try:
        columns, rows = extract_table(fetch_page())
    except Exception as error:  # Netzwerk, HTML-Änderung, ungültiges JSON
        if previous is None:
            print(f"Freie Gärten nicht geladen und keine vorherige Datei: {error}", file=sys.stderr)
            return 1
        print(f"Freie Gärten nicht aktualisiert ({error}), vorherige Datei bleibt.", file=sys.stderr)
        return 0

    unchanged = previous is not None and previous.get("columns") == columns and previous.get("rows") == rows
    data = {
        "source": SOURCE_URL,
        "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "changedAt": (unchanged and previous.get("changedAt")) or date.today().isoformat(),
        "columns": columns,
        "rows": rows,
    }
    write_atomic(out, json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"Freie Gärten: {len(rows)} Einträge, {'unverändert' if unchanged else 'geändert'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
