import { useEffect, useMemo, useState } from "react";
import type { GardenValue } from "../types/garden";
import { formatDate, formatGardenValue } from "../utils/formatting";
import {
  type GardenChange,
  type HistorySnapshot,
  loadFreeGardensHistory,
  summarizeHistory,
} from "../utils/freeGardensHistory";

const FIELD_LABELS: Record<GardenChange["field"], string> = {
  parcel: "Parzelle",
  size: "Größe",
  availableFrom: "frei ab",
  valuation: "Wertermittlung",
  valueReduction: "Wertminderung",
};

function formatChangeValue(field: GardenChange["field"], value: GardenChange["from"]): string {
  if (field === "size") return `${value} m²`;
  if (field === "availableFrom") return formatDate(String(value));
  if (field === "valuation" || field === "valueReduction") {
    return formatGardenValue(value as GardenValue, { maximumFractionDigits: 2 });
  }
  return String(value);
}

interface FreeGardensHistoryProps {
  onGardenClick: (gardenNumber: string) => void;
}

/** Verlauf der Vereinsliste: wann welcher Garten frei war und was sich an ihm geändert hat */
export default function FreeGardensHistory({ onGardenClick }: FreeGardensHistoryProps) {
  const [snapshots, setSnapshots] = useState<HistorySnapshot[] | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadFreeGardensHistory()
      .then((result) => {
        if (!cancelled) setSnapshots(result);
      })
      .catch((error) => {
        console.error("Error loading free gardens history:", error);
        if (!cancelled) setHasError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const history = useMemo(() => summarizeHistory(snapshots ?? []), [snapshots]);
  const first = snapshots?.[0];
  const last = snapshots?.at(-1);
  const fromArchive = snapshots?.filter((s) => s.source.includes("web.archive.org")).length ?? 0;

  return (
    <div className="mt-6 bg-scholle-bg-container rounded-lg border border-scholle-border shadow-xs overflow-hidden">
      <div className="bg-scholle-green text-white px-4 py-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Verlauf der freien Gärten</h2>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/20">
          {history.length} Gärten
        </span>
      </div>

      {hasError ? (
        <p className="px-4 py-6 text-sm text-scholle-text-light text-center">
          Der Verlauf konnte nicht geladen werden.
        </p>
      ) : !snapshots ? (
        <p className="px-4 py-6 text-sm text-scholle-text-light text-center">Lade Verlauf…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-scholle-bg-light text-scholle-text-light text-left">
                <tr>
                  <th className="px-4 py-2 font-semibold">Nr.</th>
                  <th className="px-4 py-2 font-semibold">Parzelle</th>
                  <th className="px-4 py-2 font-semibold">Erstmals frei</th>
                  <th className="px-4 py-2 font-semibold">Zuletzt frei</th>
                  <th className="px-4 py-2 font-semibold text-center">Mal frei</th>
                  <th className="px-4 py-2 font-semibold">Änderungen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-scholle-border">
                {history.map((h) => (
                  <tr
                    key={h.number}
                    onClick={() => onGardenClick(h.number)}
                    className={`align-top hover:bg-scholle-bg-light cursor-pointer transition-colors ${h.periods > 1 ? "bg-yellow-50" : ""}`}
                  >
                    <td className="px-4 py-2 font-medium text-scholle-text">{h.number}</td>
                    <td className="px-4 py-2 text-scholle-text-light">{h.parcel}</td>
                    <td className="px-4 py-2 text-scholle-text">{formatDate(h.firstSeen)}</td>
                    <td className="px-4 py-2">
                      {h.lastSeen === last?.date ? (
                        <span className="text-scholle-green font-medium">noch frei</span>
                      ) : (
                        <>
                          <span className="text-scholle-text">{formatDate(h.lastSeen)}</span>
                          {h.goneBy && (
                            <span className="block text-xs text-scholle-text-light">
                              weg spätestens {formatDate(h.goneBy)}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center text-scholle-text">{h.periods}</td>
                    <td className="px-4 py-2 text-xs text-scholle-text-light">
                      {h.changes.map((c) => (
                        <span key={`${c.date}-${c.field}`} className="block">
                          {formatDate(c.date)}: {FIELD_LABELS[c.field]}{" "}
                          {formatChangeValue(c.field, c.from)} → {formatChangeValue(c.field, c.to)}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="px-4 py-3 bg-scholle-bg-light border-t border-scholle-border text-xs text-scholle-text-light">
            <summary className="cursor-pointer">
              {snapshots.length} Stände
              {first && last && ` vom ${formatDate(first.date)} bis ${formatDate(last.date)}`},
              davon {fromArchive} von archive.org. Gelb: Garten war mehrmals frei.
            </summary>
            <ul className="mt-2 space-y-0.5">
              {snapshots.map((s) => (
                <li key={s.source}>
                  {formatDate(s.date)}: {s.gardens.length} Gärten,{" "}
                  {s.source.startsWith("http") ? (
                    <a
                      href={s.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-scholle-blue hover:text-scholle-blue-dark underline"
                    >
                      {s.source.includes("web.archive.org") ? "archive.org" : "Vereinsseite"}
                    </a>
                  ) : (
                    s.source
                  )}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
