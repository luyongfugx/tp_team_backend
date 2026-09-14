"use client";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { cachedTeamspaceTranslations, isBaseTeamspaceLocale, loadTeamspaceTranslations, type TeamspaceTranslations } from "./translations";

export function useTeamspaceTranslations(locale: string, initialData?: TeamspaceTranslations) {
  const [state, setState] = useState<{ locale: string; data?: TeamspaceTranslations; failed?: boolean }>();
  useEffect(() => {
    if (initialData) return;
    let current = true;
    loadTeamspaceTranslations(locale).then(data => {
      if (current) setState({ locale, data });
    }).catch(() => {
      if (current) setState({ locale, failed: true });
    });
    return () => { current = false; };
  }, [locale, initialData]);
  const data = initialData ?? cachedTeamspaceTranslations(locale) ?? (state?.locale === locale ? state.data : undefined);
  return {
    data,
    ready: !!data || isBaseTeamspaceLocale(locale) || state?.locale === locale && !state.failed,
    failed: !initialData && state?.locale === locale && !!state.failed,
  };
}

// Use already-loaded account messages while a language chunk is in transit.
// Do not briefly show the photo workspace in English when another language is selected.
export function TranslationLoading({ locale, failed }: { locale: string; failed: boolean }) {
  return <div role="status" lang={locale} style={{ padding: 40, textAlign: "center" }}>
    {t(locale, failed ? "common.networkError" : "common.loading")}
    {failed && <button type="button" onClick={() => window.location.reload()} style={{ display: "block", margin: "16px auto" }}>
      {t(locale, "dashboard.refresh")}
    </button>}
  </div>;
}
