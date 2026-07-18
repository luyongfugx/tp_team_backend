"use client"

import { useEffect, useRef, useState } from "react"
import { Globe2 } from "lucide-react"
import { type AppLocale, setClientLocale, supportedLocaleOptions } from "@/lib/i18n"

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
  const rootRef = useRef<HTMLDivElement>(null)
  const current = supportedLocaleOptions.find((option) => option.value === locale) || supportedLocaleOptions[0]

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
          className="absolute right-0 top-[calc(100%+10px)] w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-lg"
          role="listbox"
        >
          {supportedLocaleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => selectLocale(option.value)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium leading-tight transition hover:bg-muted ${
                option.value === current.value ? "bg-muted" : ""
              }`}
              role="option"
              aria-selected={option.value === current.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
