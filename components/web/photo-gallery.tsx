"use client"

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react"
import { ChevronLeft, ChevronRight, Download, Folder, Home, ImageOff, X } from "lucide-react"

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
  meta: string
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
}: {
  header: GalleryHeader
  days: WebPhotoDay[]
  labels: GalleryLabels
}) {
  const allPhotos = useMemo(() => days.flatMap((day) => day.photos), [days])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const activePhoto = activeIndex == null ? null : allPhotos[activeIndex] ?? null
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

  return (
    <main className="min-h-svh bg-[#080d13] pb-[calc(96px+env(safe-area-inset-bottom))] text-white sm:pb-[calc(104px+env(safe-area-inset-bottom))]">
      <div className="mx-auto min-h-svh w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 -mx-4 mb-8 flex items-center bg-[#080d13]/92 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <a
            href="https://www.timeprint.net"
            className="inline-flex size-10 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
            aria-label="Timeprint home"
          >
            <Home className="size-6" />
          </a>
        </header>

        <section className="mb-10 flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-[#755a21] shadow-[0_12px_30px_rgba(0,0,0,0.28)] sm:size-20">
            <Folder className="size-9 fill-white text-white sm:size-11" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold tracking-normal text-white sm:text-4xl">
              {header.title}
            </h1>
            <p className="mt-2 truncate text-lg text-white/50 sm:text-xl">{header.subtitle}</p>
            <p className="mt-1 truncate text-lg text-white/50 sm:text-xl">{header.meta}</p>
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
                <h2 className="mb-4 text-xl font-semibold tracking-normal text-white sm:text-2xl">
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
                className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/70 sm:inline-flex"
                aria-label="Previous photo"
              >
                <ChevronLeft className="size-7" />
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
                className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/70 sm:inline-flex"
                aria-label="Next photo"
              >
                <ChevronRight className="size-7" />
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
        className="fixed inset-x-0 bottom-0 z-40 block border-t border-black/10 bg-white px-4 py-3 text-black shadow-[0_-10px_30px_rgba(0,0,0,0.18)]"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
          <img
            src="/logo.png"
            alt="Timeprint"
            className="size-14 shrink-0 rounded-xl sm:size-16"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold text-black sm:text-xl">{labels.bannerTitle}</div>
            <div className="truncate text-sm text-black/55 sm:text-base">{labels.bannerSubtitle}</div>
          </div>
          <span className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#1295f5] px-7 py-3 text-lg font-semibold text-white shadow-sm sm:px-9">
            {labels.open}
          </span>
        </div>
      </a>
    </main>
  )
}
