export const LEGACY_VERIFICATION_ERROR_CODES: Readonly<Record<string, string>> = {
  "-2100": "400",
  "-2200": "424",
  "-2300": "500",
  "-2301": "404",
  "-2302": "502",
  "-2303": "422",
  "-2304": "410",
  "-2400": "409",
  "-2401": "412",
  "-2402": "416",
  "-2403": "403",
  "-2404": "406",
  "-2500": "503",
}

export function normalizeVerificationErrorCode(value: unknown, fallback = "500") {
  const code = typeof value === "string" ? value.trim() : ""
  if (!code) return fallback
  const normalized = LEGACY_VERIFICATION_ERROR_CODES[code] || code
  return /^\d{3}$/.test(normalized) ? normalized : fallback
}
