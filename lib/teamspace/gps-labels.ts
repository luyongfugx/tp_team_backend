import { resolveLocale } from "@/lib/i18n";
import labels from "./gps-labels.json";

/** Separate coordinate columns retained for legacy text-only Excel exports. */
export function gpsColumnLabels(locale: string) {
  return (labels as Record<string, string[]>)[resolveLocale(locale || "en")];
}
