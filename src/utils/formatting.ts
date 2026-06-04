/**
 * Shared formatting utilities
 */
import { type GardenValue, ON_REQUEST } from "../types/garden";

/**
 * Formats a date string to German locale format
 * Handles special cases like "sofort" or "ab sofort"
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "-";
  const lowerCaseDate = dateString.toLowerCase();
  if (lowerCaseDate === "sofort" || lowerCaseDate === "ab sofort") {
    return "Sofort";
  }
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString("de-DE");
  } catch {
    return dateString;
  }
}

/**
 * Formats a number as currency in EUR
 */
export function formatCurrency(
  amount: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(amount);
}

/**
 * Wandelt einen Garten-Wert in eine Zahl um (für Sortierung, Filter, Vergleiche).
 * "n.V." (nach Vereinbarung) wird als 0 / unbekannt behandelt.
 */
export function gardenValueToNumber(value: GardenValue): number {
  return value === ON_REQUEST ? 0 : value;
}

/**
 * Prüft, ob ein Garten-Wert gesetzt ist (positiver Betrag oder "n.V.").
 */
export function hasGardenValue(value: GardenValue): boolean {
  return value === ON_REQUEST || value > 0;
}

/**
 * Volltext für den Sonderwert "nach Vereinbarung" (Daten-Sentinel ON_REQUEST = "n.V.").
 */
export const ON_REQUEST_LABEL = "nach Vereinbarung";

/**
 * Formatiert einen Garten-Wert als Währung oder als "nach Vereinbarung".
 * Gibt für den Sonderwert "n.V." den ausgeschriebenen Text zurück, damit er
 * verständlich ist (vor allem in der Detailansicht mit ausreichend Platz).
 */
export function formatGardenValue(
  value: GardenValue,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  return value === ON_REQUEST ? ON_REQUEST_LABEL : formatCurrency(value, options);
}

/**
 * Formats the last database update date
 */
export function formatLastUpdate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}
