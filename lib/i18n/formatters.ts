// lib/i18n/formatters.ts

import { SupportedLocale, isRtlLocale } from "./config";

/**
 * Format numbers according to the active locale using Intl.NumberFormat
 */
export function formatNumber(
  value: number,
  locale: string = "ar",
  options?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch (err) {
    return value.toLocaleString();
  }
}

/**
 * Format dates according to locale
 */
export function formatDate(
  date: Date | number | string,
  locale: string = "ar",
  options?: Intl.DateTimeFormatOptions
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);

  const defaultOptions: Intl.DateTimeFormatOptions = options || {
    year: "numeric",
    month: "short",
    day: "numeric",
  };

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(d);
  } catch (err) {
    return d.toLocaleDateString();
  }
}

/**
 * Format currency amounts according to locale
 */
export function formatCurrency(
  amount: number,
  locale: string = "ar",
  currency: string = "USD"
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount);
  } catch (err) {
    return `${amount} ${currency}`;
  }
}

/**
 * Format relative time (e.g., "5 minutes ago", "منذ ٥ دقائق")
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: string = "ar"
): string {
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    return rtf.format(value, unit);
  } catch (err) {
    return `${value} ${unit}`;
  }
}

/**
 * Complete ICU/Intl Plural Resolver supporting Arabic 6 plural categories (zero, one, two, few, many, other)
 */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export function formatPlural(
  count: number,
  locale: string = "ar",
  forms: PluralForms
): string {
  try {
    const pr = new Intl.PluralRules(locale);
    const category = pr.select(count); // 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

    const template = forms[category as keyof PluralForms] || forms.other;
    return template.replace("{count}", formatNumber(count, locale));
  } catch (err) {
    const fallbackTemplate = count === 1 ? (forms.one || forms.other) : forms.other;
    return fallbackTemplate.replace("{count}", String(count));
  }
}
