/** Server wall time through final result preparation; excludes client upload/polling. */
export function recognitionTotalMs(result: unknown): number | null {
  if (!result || typeof result !== "object") return null
  const timings = (result as Record<string, unknown>).timings
  if (!timings || typeof timings !== "object") return null
  const total = (timings as Record<string, unknown>).totalMs
  return typeof total === "number" && Number.isFinite(total) && total >= 0 ? total : null
}

export function formatRecognitionTime(total: number | null | undefined): string {
  return typeof total === "number" && Number.isFinite(total) && total >= 0
    ? `${(total / 1000).toFixed(2)} s` : "—"
}
