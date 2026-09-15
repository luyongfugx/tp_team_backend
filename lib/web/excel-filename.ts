import { dateKey } from "@/lib/workspace/model";

// Leave room for the date and extension on Windows and byte-limited filesystems.
// Never truncate in the middle of an emoji or strip non-Latin team/member names.
function namePart(value: string) {
  const cleaned = value.normalize("NFC").replace(/[\x00-\x1f<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "-").replace(/^\.+|[. -]+$/g, "");
  let result = "", bytes = 0;
  for (const char of cleaned) {
    const size = new TextEncoder().encode(char).length;
    if (result.length + char.length > 32 || bytes + size > 90) break;
    result += char; bytes += size;
  }
  return result.replace(/[. -]+$/g, "");
}

export function excelExportFilename(teamName: string, scopeName: string, timeZone = "UTC", now = Date.now()) {
  let date: string;
  try { date = dateKey(now, timeZone); } catch { date = dateKey(now, "UTC"); }
  const team = namePart(teamName) || "Timeprint";
  const scope = namePart(scopeName.replace(/\.xlsx$/i, ""));
  return `${team}-${date}${scope && scope !== team ? `-${scope}` : ""}.xlsx`;
}

// Blob downloads otherwise discard Content-Disposition and revert to the page title.
export function excelResponseFilename(response: Response, fallback: string) {
  const encoded = response.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      const filename = decodeURIComponent(encoded.trim());
      if (filename.length <= 90 && /\.xlsx$/i.test(filename) && !/[\x00-\x1f<>:"/\\|?*]/.test(filename) && !filename.startsWith(".")) return filename;
    } catch { /* An older server may send an invalid header; keep the suggested name. */ }
  }
  return fallback;
}
