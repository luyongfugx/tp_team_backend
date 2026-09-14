import { resolveLocale } from "@/lib/i18n";
import type { GalleryScope } from "./gallery";

// Exported files outlive the request. Use the public site, never a container URL
// or a caller-controlled Host / X-Forwarded-Host header.
export function exportGalleryURL(
  scope: GalleryScope,
  locale: string,
  publicOrigin = process.env.TEAMSPACE_PUBLIC_ORIGIN?.trim() || "https://teamspace.timeprint.net",
) {
  const origin = new URL(publicOrigin);
  if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password ||
    origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("INVALID_TEAMSPACE_PUBLIC_ORIGIN");
  }
  const url = new URL(`/web/${scope.kind}/${encodeURIComponent(scope.id)}/photos`, origin);
  if (locale) url.searchParams.set("lang", resolveLocale(locale));
  return url.toString();
}
