import translations from "@/lib/photoShareTranslations.generated.json"

export type PhotoShareCopy = typeof translations.en

const localeMap = new Map(
  Object.keys(translations).map((locale) => [locale.toLowerCase(), locale]),
)

const legacyAliases: Record<string, string> = {
  in: "id",
  iw: "he",
  ji: "yi",
  no: "nb",
  tl: "fil",
}
const baseLocales: Record<string, string> = { zh: "zh-Hans", kk: "kk-KZ", km: "km-KH", lo: "lo-LA" }

// The app's Kurdish locale uses Latin script (Kurmancî).
const rtlLanguages = new Set(["ar", "arz", "dv", "fa", "he", "ps", "ur", "yi"])

function canonicalCandidates(languageTag: string) {
  const normalized = languageTag.trim().replaceAll("_", "-").toLowerCase()
  if (!normalized) return []

  const normalizedParts = normalized.split("-")
  const baseAlias = legacyAliases[normalizedParts[0]]
  const aliasedByBase = baseAlias
    ? [baseAlias, ...normalizedParts.slice(1)].join("-")
    : normalized
  const aliased = legacyAliases[normalized] || aliasedByBase
  const candidates = [aliased]
  if (aliased.startsWith("zh-")) {
    if (/^zh-(hant|tw|mo|hk)/.test(aliased)) candidates.push("zh-hant")
    else if (aliased !== "zh-hk") candidates.push("zh-hans")
  }
  const base = aliased.split("-")[0]
  if (base && base !== aliased) candidates.push(base)
  if (baseLocales[base]) candidates.push(baseLocales[base].toLowerCase())
  return [...new Set(candidates)]
}

function acceptedLanguages(header: string) {
  return header
    .split(",")
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().split(";")
      const quality = parameters
        .map((parameter) => parameter.trim().match(/^q=([0-9.]+)$/i)?.[1])
        .find(Boolean)
      return { tag, quality: quality ? Number(quality) : 1 }
    })
    .filter(({ tag, quality }) => tag && quality > 0)
    .sort((left, right) => right.quality - left.quality)
}

export function resolvePhotoShareLocale(acceptLanguage: string) {
  for (const { tag } of acceptedLanguages(acceptLanguage)) {
    for (const candidate of canonicalCandidates(tag)) {
      const locale = localeMap.get(candidate)
      if (locale) return locale
    }
  }
  return "en"
}

export function getPhotoShareCopy(acceptLanguage: string): { locale: string; direction: "ltr" | "rtl"; copy: PhotoShareCopy } {
  const locale = resolvePhotoShareLocale(acceptLanguage)
  return {
    locale,
    direction: rtlLanguages.has(locale.toLowerCase().split("-")[0]) ? "rtl" : "ltr",
    copy: translations[locale as keyof typeof translations] || translations.en,
  }
}
