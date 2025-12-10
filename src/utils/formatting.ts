/**
 * Shared formatting utilities
 */

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
