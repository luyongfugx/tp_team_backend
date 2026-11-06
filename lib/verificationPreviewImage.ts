// Development reports read the same signed preview as the live H5 report.
// No production storage credentials or uploaded photo copies are needed locally.
export function matchingReportImage(html: string, expected: string): string | null {
  try {
    const original = new URL(expected)
    if (original.protocol !== "https:" || original.username || original.password || !/^\/verify\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.jpg$/.test(original.pathname)) return null
    for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
      const tag = match[0]
      if (!/\bproperty\s*=\s*["']og:image["']/i.test(tag)) continue
      const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1]
      if (!content) continue
      const url = new URL(content.replaceAll("&amp;", "&"))
      // Accept only the image associated with this exact task. Never select an
      // unrelated image or turn the adapter into a general remote-URL loader.
      if (url.origin === original.origin && url.pathname === original.pathname && !url.username && !url.password && !url.hash) return url.href
    }
  } catch { /* A missing/changed preview never changes the verification result. */ }
  return null
}

export async function livePreviewImage(taskID: string, expected: unknown) {
  if (process.env.NODE_ENV !== "development" || !process.env.TP_VERIFICATION_READ_API_BASE || typeof expected !== "string") return null
  try {
    const origin = new URL(process.env.TP_VERIFICATION_READ_REPORT_ORIGIN || "https://h5.timeprint.net")
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) return null
    const response = await fetch(new URL(`/verify/${encodeURIComponent(taskID)}`, origin), {cache:"no-store", redirect:"error", signal:AbortSignal.timeout(10000)})
    if (!response.ok) return null
    return matchingReportImage(await response.text(), expected)
  } catch { return null }
}
