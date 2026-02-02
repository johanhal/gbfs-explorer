
// timestampUtils.ts

/**
 * Parses a variety of timestamp formats (UNIX seconds, milliseconds, ISO strings)
 * and returns a Date object.
 *
 * @param timestamp The timestamp to parse.
 * @returns A Date object or null if parsing fails.
 */
export function parseTimestamp(timestamp: string | number | null | undefined): Date | null {
  if (timestamp === null || timestamp === undefined) {
    return null;
  }

  // Handle numeric timestamps (seconds or milliseconds)
  if (typeof timestamp === "number") {
    const tsString = String(timestamp);
    if (tsString.length === 10) {
      // UNIX timestamp in seconds
      return new Date(timestamp * 1000);
    }
    if (tsString.length === 13) {
      // UNIX timestamp in milliseconds
      return new Date(timestamp);
    }
  }

  // Handle string timestamps (ISO 8601, or numeric strings)
  if (typeof timestamp === "string") {
    // Check if it's a string representation of a number
    if (!isNaN(Number(timestamp))) {
      const num = Number(timestamp);
      const tsString = String(Math.trunc(num));
      if (tsString.length === 10) {
        return new Date(num * 1000);
      }
      if (tsString.length === 13) {
        return new Date(num);
      }
    }
    // Otherwise, parse as a date string
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null; // Return null if no valid format is detected
}
