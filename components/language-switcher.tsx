"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Globe2, Search } from "lucide-react"
import { type AppLocale, setClientLocale, supportedLocaleOptions, t, type LocaleRegion } from "@/lib/i18n"

const localeRegionOrder: LocaleRegion[] = ["asia", "europe", "africa", "northAmerica", "southAmerica", "oceania"]

export function LanguageSwitcher({
  locale,
  onLocaleChange,
  className = "",
}: {
  locale: AppLocale | string
  onLocaleChange?: (locale: AppLocale) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const current = supportedLocaleOptions.find((option) => option.value === locale) || supportedLocaleOptions[0]
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const groupedOptions = useMemo(() => {
    return localeRegionOrder
      .map((region) => {
        const options = supportedLocaleOptions.filter((option) => {
          if (option.region !== region) return false
          if (!normalizedQuery) return true
          return `${option.label} ${option.englishLabel} ${option.value} ${option.searchText}`.toLocaleLowerCase().includes(normalizedQuery)
        })
        return { region, options }
      })
      .filter((group) => group.options.length > 0)
  }, [normalizedQuery])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener("pointerdown", handlePointerDown)
    return () => window.removeEventListener("pointerdown", handlePointerDown)
  }, [open])

  function selectLocale(value: AppLocale) {
    const next = setClientLocale(value)
    onLocaleChange?.(next)
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={rootRef} className={`z-40 ${className}`}>
      <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted/70"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe2 className="size-4" />
        <span>{current.label}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+10px)] w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg"
          role="listbox"
        >
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(locale, "language.searchPlaceholder")}
              className="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              autoFocus
            />
          </div>

          <div className="max-h-[min(28rem,calc(100vh-8rem))] overflow-auto pr-1">
            {groupedOptions.length === 0 && (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">{t(locale, "language.noResults")}</div>
            )}
            {groupedOptions.map((group) => (
              <section key={group.region} className="py-1.5">
                <div className="mb-1 flex items-center rounded-md border-l-4 border-orange-500 bg-orange-50 px-2.5 py-1.5 text-sm font-semibold text-orange-950 shadow-sm">
                  {t(locale, `language.region.${group.region}`)}
                </div>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-6">
                  {group.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectLocale(option.value)}
                      className={`min-w-0 rounded-md px-2 py-2 text-left text-sm font-medium leading-tight transition hover:bg-muted ${
                        option.value === current.value ? "bg-muted text-foreground" : "text-foreground/85"
                      }`}
                      role="option"
                      aria-selected={option.value === current.value}
                      title={option.englishLabel}
                    >
                      <span className="block truncate">{option.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
