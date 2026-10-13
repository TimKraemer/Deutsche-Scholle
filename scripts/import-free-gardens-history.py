#!/usr/bin/env python3
"""
Einmaliger Import alter Stände der Liste freier Gärten nach public/freie-gaerten-verlauf.json.

Quellen:
- alle Aufnahmen der Vereinsseite bei archive.org (Wayback Machine), ab Juli 2025
- der im Repo abgetippte Stand vom 04.06.2026 (src/data/mockGardens.ts in Commit 0275745),
  den archive.org nicht hat

Den aktuellen Stand hängt danach update-free-gardens.py an (beim Build und per Cron).
Eine vorhandene Verlaufsdatei wird ersetzt.

Aufruf: python3 scripts/import-free-gardens-history.py
"""

import importlib.util
import json
import re
import subprocess
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "freie-gaerten-verlauf.json"

# Dateiname mit Bindestrich, deshalb über importlib statt import
_spec = importlib.util.spec_from_file_location(
    "update_free_gardens", ROOT / "scripts" / "update-free-gardens.py"
)
ufg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ufg)

COLUMNS = ["Nr.", "Parzelle", "Größe", "frei ab", "Wertermittlung", "Wertminderung"]
CDX_URL = "https://web.archive.org/cdx/search/cdx?" + urllib.parse.urlencode(
    {
        "url": "deutsche-scholle-os.de/freie-gaerten/index.php",
        "output": "json",
        "fl": "timestamp,original",
        "filter": "statuscode:200",
        "collapse": "digest",  # gleiche Inhalte nur einmal
    }
)
MOCK_COMMIT = "0275745"
MOCK_DATE = "2026-06-04"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": ufg.USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def wayback_snapshots() -> list[dict]:
    snapshots = []
    for timestamp, original in json.loads(fetch(CDX_URL))[1:]:
        # "id_" liefert die Seite unverändert, ohne die Leiste von archive.org
        raw = fetch(f"https://web.archive.org/web/{timestamp}id_/{original}")
        columns, rows = ufg.extract_table(raw.decode("cp1252", errors="replace"))
        snapshots.append(
            {
                "date": f"{timestamp[:4]}-{timestamp[4:6]}-{timestamp[6:8]}",
                "source": f"https://web.archive.org/web/{timestamp}/{original}",
                "columns": columns,
                "rows": rows,
            }
        )
        time.sleep(1)  # archive.org drosselt schnelle Abrufe
    return snapshots


def money(value: str) -> str:
    """865 -> "865,00 €", 1267 -> "1.267,00 €", ON_REQUEST (leeres Feld der Vereinsseite) -> "" """
    if value == "ON_REQUEST":
        return ""
    text = f"{float(value):,.2f}".replace(",", " ").replace(".", ",").replace(" ", ".")
    return f"{text} €"


def mock_snapshot() -> dict:
    """Der abgetippte Stand als Zeilen im Format der Vereinsseite"""
    source = subprocess.run(
        ["git", "show", f"{MOCK_COMMIT}:src/data/mockGardens.ts"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    rows = []
    for block in re.findall(r"\{([^{}]*)\}", source):
        fields = dict(re.findall(r'(\w+): "?([^",\n]*)"?,', block))
        if "number" not in fields:
            continue
        date = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", fields["availableFrom"])
        rows.append(
            [
                fields["number"],
                fields["parcel"],
                fields["size"],
                f"{date[3]}.{date[2]}.{date[1]}" if date else fields["availableFrom"],
                money(fields["valuation"]),
                money(fields["valueReduction"]),
            ]
        )
    return {
        "date": MOCK_DATE,
        "source": f"Repo, abgetippt: src/data/mockGardens.ts in Commit {MOCK_COMMIT}",
        "columns": COLUMNS,
        "rows": rows,
    }


def main() -> None:
    snapshots = wayback_snapshots() + [mock_snapshot()]
    snapshots.sort(key=lambda s: s["date"])
    ufg.write_history(OUT, snapshots)
    print(f"Verlauf: {len(snapshots)} Stände von {snapshots[0]['date']} bis {snapshots[-1]['date']}")


if __name__ == "__main__":
    main()
