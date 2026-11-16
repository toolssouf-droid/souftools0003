"use client";

import React, { createContext, useContext, useState, useEffect, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  SupportedLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_METADATA_MAP,
  isRtlLocale,
  registerLocaleDictionary,
  translateKey,
  formatNumber as formatNumberUtil,
  formatDate as formatDateUtil,
  formatCurrency as formatCurrencyUtil,
  formatRelativeTime as formatRelativeTimeUtil,
  formatPlural as formatPluralUtil,
  PluralForms,
  createLocaleContext,
  LocaleContext,
} from "@/lib/i18n";

interface I18nContextType {
  locale: SupportedLocale;
  direction: "rtl" | "ltr";
  isRtl: boolean;
  pseudoMode: boolean;
  setPseudoMode: (val: boolean) => void;
  setLocale: (newLocale: SupportedLocale) => void;
  t: (key: string, params?: Record<string, any>, fallback?: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatRelativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit) => string;
  formatPlural: (count: number, forms: PluralForms) => string;
  getSoufAIContext: (overrideResponseLang?: string) => LocaleContext;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({
  children,
  initialLocale = "ar",
  initialDictionary = {},
}: {
  children: React.ReactNode;
  initialLocale?: string;
  initialDictionary?: Record<string, any>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const activeLocale: SupportedLocale = SUPPORTED_LOCALES.includes(initialLocale as SupportedLocale)
    ? (initialLocale as SupportedLocale)
    : DEFAULT_LOCALE;

  const [locale, setLocaleState] = useState<SupportedLocale>(activeLocale);
  const [pseudoMode, setPseudoMode] = useState<boolean>(false);

  // Register initial dictionary
  if (initialDictionary && Object.keys(initialDictionary).length > 0) {
    registerLocaleDictionary(activeLocale, initialDictionary);
  }

  const isRtl = isRtlLocale(locale);
  const direction = isRtl ? "rtl" : "ltr";

  // Sync document attribute on client side
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = direction;
      document.body.dir = direction;

      // Store in cookie and localStorage for fast restoration
      try {
        localStorage.setItem("souftools_locale", locale);
        document.cookie = `souftools_locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
      } catch (e) {
        // Safe fallback if storage disabled
      }
    }
  }, [locale, direction]);

  // Sync locale state with pathname if URL changes
  useEffect(() => {
    if (pathname) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length > 0 && SUPPORTED_LOCALES.includes(parts[0] as SupportedLocale)) {
        if (parts[0] !== locale) {
          setLocaleState(parts[0] as SupportedLocale);
        }
      }
    }
  }, [pathname, locale]);

  const handleSetLocale = (newLocale: SupportedLocale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;
    setLocaleState(newLocale);

    try {
      localStorage.setItem("souftools_locale", newLocale);
      document.cookie = `souftools_locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {}

    // Navigate smoothly to the new locale URL via Next.js client router
    let targetPath = `/${newLocale}`;
    if (pathname) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length > 0 && SUPPORTED_LOCALES.includes(parts[0] as SupportedLocale)) {
        parts[0] = newLocale;
        targetPath = `/${parts.join("/")}`;
      } else {
        targetPath = `/${newLocale}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
      }
    }

    startTransition(() => {
      router.replace(targetPath);
    });
  };

  const t = (key: string, params?: Record<string, any>, fallback?: string) => {
    return translateKey(locale, key, params, fallback, pseudoMode);
  };

  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
    return formatNumberUtil(value, locale, options);
  };

  const formatDate = (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => {
    return formatDateUtil(date, locale, options);
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return formatCurrencyUtil(amount, locale, currency);
  };

  const formatRelativeTime = (value: number, unit: Intl.RelativeTimeFormatUnit) => {
    return formatRelativeTimeUtil(value, unit, locale);
  };

  const formatPlural = (count: number, forms: PluralForms) => {
    return formatPluralUtil(count, locale, forms);
  };

  const getSoufAIContext = (overrideResponseLang?: string) => {
    return createLocaleContext(locale, overrideResponseLang);
  };

  return (
    <I18nContext.Provider
      value={{
        locale,
        direction,
        isRtl,
        pseudoMode,
        setPseudoMode,
        setLocale: handleSetLocale,
        t,
        formatNumber,
        formatDate,
        formatCurrency,
        formatRelativeTime,
        formatPlural,
        getSoufAIContext,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useSoufI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // Return safe default fallback if called outside provider
    return {
      locale: DEFAULT_LOCALE as SupportedLocale,
      direction: "rtl" as const,
      isRtl: true,
      pseudoMode: false,
      setPseudoMode: () => {},
      setLocale: () => {},
      t: (key: string, _params?: any, fallback?: string) => fallback || key.split(".").pop() || key,
      formatNumber: (v: number) => String(v),
      formatDate: (d: any) => String(d),
      formatCurrency: (a: number) => `$${a}`,
      formatRelativeTime: (v: number, u: string) => `${v} ${u}`,
      formatPlural: (c: number, f: PluralForms) => f.other || String(c),
      getSoufAIContext: () => createLocaleContext("ar"),
    };
  }
  return context;
}
