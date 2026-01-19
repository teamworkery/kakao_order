/**
 * Common formatting utilities for the application
 */

/**
 * Format a number as Korean Won currency (without the symbol)
 * @param price - The price to format
 * @returns Formatted price string with thousand separators (e.g., "12,000")
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR").format(price);
}

/**
 * Format a number as Korean Won currency with the symbol
 * @param price - The price to format
 * @returns Formatted price string with symbol (e.g., "12,000원")
 */
export function formatPriceWithUnit(price: number): string {
  return `${formatPrice(price)}원`;
}

/**
 * Format a phone number to Korean format (010-1234-5678)
 * Handles various input formats:
 * - 01012345678
 * - 010-1234-5678
 * - 010 1234 5678
 * @param phone - The phone number to format
 * @returns Formatted phone number string (e.g., "010-1234-5678")
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Handle different phone number lengths
  if (digits.length === 11) {
    // Mobile number: 010-1234-5678
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    // Old mobile or local: 02-1234-5678 or 031-123-4567
    if (digits.startsWith("02")) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 9) {
    // Seoul landline: 02-123-4567
    if (digits.startsWith("02")) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
  }

  // Return original if format is not recognized
  return phone;
}

/**
 * Format a date to Korean locale string
 * @param date - Date object or ISO string
 * @param options - Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string (e.g., "2024년 1월 15일")
 */
export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  return dateObj.toLocaleDateString("ko-KR", options ?? defaultOptions);
}

/**
 * Format a date to short Korean format
 * @param date - Date object or ISO string
 * @returns Formatted date string (e.g., "1/15")
 */
export function formatDateShort(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  return dateObj.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
  });
}

/**
 * Format a time to Korean locale string
 * @param date - Date object or ISO string
 * @returns Formatted time string (e.g., "오후 2:30")
 */
export function formatTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  return dateObj.toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format a date and time together
 * @param date - Date object or ISO string
 * @returns Formatted date-time string (e.g., "2024년 1월 15일 오후 2:30")
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  return dateObj.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format relative time (e.g., "5분 전", "1시간 후")
 * @param date - Date object or ISO string
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat("ko-KR", { numeric: "auto" });

  if (Math.abs(diffSeconds) < 60) {
    return rtf.format(diffSeconds, "second");
  } else if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  } else if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  } else {
    return rtf.format(diffDays, "day");
  }
}
