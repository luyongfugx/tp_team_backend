"use client"

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react"
import { Download, Folder, Globe2, Home, ImageOff, X } from "lucide-react"

export type WebPhoto = {
  photoID: string
  imageURL: string | null
  thumbnailURL: string | null
  downloadURL: string
  localPhotoName: string | null
  location: string | null
  userName: string | null
  projectName: string | null
  timeText: string
}

export type WebPhotoDay = {
  dateText: string
  photos: WebPhoto[]
}

type GalleryHeader = {
  title: string
  subtitle: string
  subtitleLines?: string[]
  meta: string
}

type LanguageOption = {
  value: string
  label: string
}

export type GalleryLabels = {
  back: string
  noPhotos: string
  noPhotosHint: string
  viewLarge: string
  teamPhoto: string
  downloadImage: string
  close: string
  download: string
  largeImage: string
  open: string
  bannerTitle: string
  bannerSubtitle: string
}

export function WebPhotoGallery({
  header,
  days,
  labels,
  currentLocale,
  languageOptions,
}: {
  header: GalleryHeader
  days: WebPhotoDay[]
  labels: GalleryLabels
  currentLocale: string
  languageOptions: LanguageOption[]
}) {
  const allPhotos = useMemo(() => days.flatMap((day) => day.photos), [days])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const activePhoto = activeIndex == null ? null : allPhotos[activeIndex] ?? null
  const currentLanguageLabel = languageOptions.find((option) => option.value === currentLocale)?.label || currentLocale
  const canGoPrevious = activeIndex != null && activeIndex > 0
  const canGoNext = activeIndex != null && activeIndex < allPhotos.length - 1

  function openPhoto(photoID: string) {
    const index = allPhotos.findIndex((photo) => photo.photoID === photoID)
    if (index >= 0) setActiveIndex(index)
  }

  function showPrevious() {
    setActiveIndex((index) => index == null ? index : Math.max(index - 1, 0))
  }

  function showNext() {
    setActiveIndex((index) => index == null ? index : Math.min(index + 1, allPhotos.length - 1))
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (!touchStart.current) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - touchStart.current.x
    const deltaY = touch.clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY)) return
    if (deltaX < 0) showNext()
    if (deltaX > 0) showPrevious()
  }

  function changeLanguage(locale: string) {
    const url = new URL(window.location.href)
    url.searchParams.set("lang", locale)
    url.searchParams.delete("locale")
    url.searchParams.delete("language")
    setLanguageMenuOpen(false)
    window.location.href = url.toString()
  }

  useEffect(() => {
    if (!activePhoto) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null)
      if (event.key === "ArrowLeft") showPrevious()
      if (event.key === "ArrowRight") showNext()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activePhoto, allPhotos.length])

  useEffect(() => {
    if (!languageMenuOpen) return
    function closeMenu() {
      setLanguageMenuOpen(false)
    }
    window.addEventListener("click", closeMenu)
    return () => window.removeEventListener("click", closeMenu)
  }, [languageMenuOpen])

  return (
    <main className="min-h-svh bg-[#080d13] pb-[calc(64px+env(safe-area-inset-bottom))] text-white sm:pb-[calc(70px+env(safe-area-inset-bottom))]">
      <div className="mx-auto min-h-svh w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 -mx-4 mb-3 flex items-center justify-between bg-[#080d13]/92 px-4 py-[9px] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <a
            href="https://www.timeprint.net"
            className="inline-flex size-10 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
            aria-label="Timeprint home"
          >
            <Home className="size-6" />
          </a>
          <div className="relative">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setLanguageMenuOpen((open) => !open)
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/20 bg-white px-3 text-sm font-medium text-black shadow-sm transition hover:bg-white/90"
              aria-haspopup="listbox"
              aria-expanded={languageMenuOpen}
            >
              <Globe2 className="size-4" />
              <span className="max-w-[92px] truncate">{currentLanguageLabel}</span>
            </button>
            {languageMenuOpen && (
              <div
                className="absolute right-0 top-[calc(100%+8px)] z-30 w-44 overflow-hidden rounded-md border border-black/10 bg-white py-1.5 text-left text-sm text-black shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
                role="listbox"
              >
                {languageOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      changeLanguage(option.value)
                    }}
                    className={`block w-full px-3 py-2 text-left transition hover:bg-black/[0.06] ${
                      option.value === currentLocale ? "bg-black/[0.07]" : ""
                    }`}
                    role="option"
                    aria-selected={option.value === currentLocale}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        <section className="mb-6 flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-[#755a21] shadow-[0_12px_30px_rgba(0,0,0,0.28)] sm:size-20">
            <Folder className="size-9 fill-white text-white sm:size-11" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-1xl font-bold tracking-normal text-white sm:text-4xl">
              {header.title}
            </h1>
            <div className="mt-1 space-y-0.5 text-sm text-white/50 sm:text-sm">
              {(header.subtitleLines?.length ? header.subtitleLines : [header.subtitle])
                .filter(Boolean)
                .map((line) => (
                  <p key={line} className="whitespace-normal break-words">{line}</p>
                ))}
            </div>
            <p className="mt-0.5 truncate text-xs text-white/50 sm:text-sm">{header.meta}</p>
          </div>
        </section>

        {allPhotos.length === 0 ? (
          <div className="flex min-h-[42vh] flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-center">
            <ImageOff className="mb-3 size-10 text-white/35" />
            <p className="text-lg font-medium text-white/80">{labels.noPhotos}</p>
            <p className="mt-1 text-sm text-white/45">{labels.noPhotosHint}</p>
          </div>
        ) : (
          <div className="space-y-8 pb-12">
            {days.map((day) => (
              <section key={day.dateText}>
                <h2 className="mb-4 text-m font-semibold tracking-normal text-white sm:text-m">
                  {day.dateText}
                </h2>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                  {day.photos.map((photo) => (
                    <div key={photo.photoID} className="group relative aspect-square overflow-hidden rounded-lg bg-white/[0.06]">
                      {photo.thumbnailURL ? (
                        <button
                          type="button"
                          onClick={() => openPhoto(photo.photoID)}
                          className="block size-full text-left"
                          aria-label={labels.viewLarge}
                        >
                          <img
                            src={photo.thumbnailURL}
                            alt={photo.localPhotoName || photo.location || labels.teamPhoto}
                            className="size-full object-cover transition duration-200 group-hover:scale-[1.03]"
                            loading="lazy"
                          />
                        </button>
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <ImageOff className="size-8 text-white/30" />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-2">
                        <p className="truncate text-xs font-medium text-white/90">{photo.timeText}</p>
                        <p className="truncate text-xs text-white/75">{photo.userName || ""}</p>
                      </div>
                      <a
                        href={photo.downloadURL}
                        className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition hover:bg-black/75 group-hover:opacity-100"
                        aria-label={labels.downloadImage}
                      >
                        <Download className="size-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {activePhoto && (
        <div
          className="fixed inset-0 z-50 flex touch-pan-y flex-col bg-black/95"
          onTouchStart={(event) => {
            const touch = event.touches[0]
            touchStart.current = { x: touch.clientX, y: touch.clientY }
          }}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              className="inline-flex size-10 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
              aria-label={labels.close}
            >
              <X className="size-7" />
            </button>
            <a
              href={activePhoto.downloadURL}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-white/85"
            >
              <Download className="size-4" />
              {labels.download}
            </a>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-3 pb-5">
            {canGoPrevious && (
              <button
                type="button"
                onClick={showPrevious}
                className="absolute left-2 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-3xl font-light leading-none text-white shadow-lg transition hover:bg-black/75 sm:left-4 sm:size-14"
                aria-label="Previous photo"
              >
                &lt;
              </button>
            )}
            {activePhoto.imageURL && (
              <img
                src={activePhoto.imageURL}
                alt={activePhoto.localPhotoName || activePhoto.location || labels.largeImage}
                className="max-h-full max-w-full rounded-lg object-contain"
                draggable={false}
              />
            )}
            {canGoNext && (
              <button
                type="button"
                onClick={showNext}
                className="absolute right-2 top-1/2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-3xl font-light leading-none text-white shadow-lg transition hover:bg-black/75 sm:right-4 sm:size-14"
                aria-label="Next photo"
              >
                &gt;
              </button>
            )}
          </div>
          <div className="shrink-0 px-4 pb-5 text-center text-sm text-white/55">
            {[activePhoto.timeText, activePhoto.location, activePhoto.userName, activePhoto.projectName].filter(Boolean).join(" · ")}
          </div>
        </div>
      )}

      <a
        href="https://www.timeprint.net"
        className="fixed inset-x-0 bottom-0 z-40 block border-t border-black/10 bg-white px-3 py-2 text-black shadow-[0_-10px_30px_rgba(0,0,0,0.18)]"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Timeprint"
            className="size-9 shrink-0 rounded-lg sm:size-11"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-black sm:text-base">{labels.bannerTitle}</div>
            <div className="truncate text-xs text-black/55 sm:text-sm">{labels.bannerSubtitle}</div>
          </div>
          <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-[#1295f5] px-4 py-1.5 text-sm font-semibold text-white shadow-sm sm:px-5 sm:py-2">
            {labels.open}
          </span>
        </div>
      </a>
    </main>
  )
}
