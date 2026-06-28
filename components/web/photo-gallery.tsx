"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, Download, Folder, ImageOff, Maximize2, X } from "lucide-react"

export type WebPhoto = {
  photoID: string
  imageURL: string | null
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

export function WebPhotoGallery({
  header,
  days,
}: {
  header: GalleryHeader
  days: WebPhotoDay[]
}) {
  const allPhotos = useMemo(() => days.flatMap((day) => day.photos), [days])
  const [activePhoto, setActivePhoto] = useState<WebPhoto | null>(null)

  return (
    <main className="min-h-svh bg-[#080d13] text-white">
      <div className="mx-auto min-h-svh w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 -mx-4 mb-8 flex items-center justify-between bg-[#080d13]/92 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <button
            type="button"
            onClick={() => history.length > 1 ? history.back() : undefined}
            className="inline-flex size-10 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
            aria-label="返回"
          >
            <ArrowLeft className="size-7" />
          </button>
          <div className="rounded-lg border border-white/45 p-1 text-white/85">
            <Maximize2 className="size-5" />
          </div>
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
            <p className="text-lg font-medium text-white/80">暂无照片</p>
            <p className="mt-1 text-sm text-white/45">上传后的图片会按日期显示在这里</p>
          </div>
        ) : (
          <div className="space-y-10 pb-12">
            {days.map((day) => (
              <section key={day.dateText}>
                <h2 className="mb-5 text-3xl font-bold tracking-normal text-white sm:text-4xl">
                  {day.dateText}
                </h2>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                  {day.photos.map((photo) => (
                    <div key={photo.photoID} className="group relative aspect-square overflow-hidden rounded-lg bg-white/[0.06]">
                      {photo.imageURL ? (
                        <button
                          type="button"
                          onClick={() => setActivePhoto(photo)}
                          className="block size-full text-left"
                          aria-label="查看大图"
                        >
                          <img
                            src={photo.imageURL}
                            alt={photo.localPhotoName || photo.location || "团队照片"}
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
                        aria-label="下载图片"
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
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            <button
              type="button"
              onClick={() => setActivePhoto(null)}
              className="inline-flex size-10 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
              aria-label="关闭"
            >
              <X className="size-7" />
            </button>
            <a
              href={activePhoto.downloadURL}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-white/85"
            >
              <Download className="size-4" />
              下载
            </a>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-3 pb-5">
            {activePhoto.imageURL && (
              <img
                src={activePhoto.imageURL}
                alt={activePhoto.localPhotoName || activePhoto.location || "大图"}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            )}
          </div>
          <div className="shrink-0 px-4 pb-5 text-center text-sm text-white/55">
            {[activePhoto.timeText, activePhoto.location, activePhoto.userName, activePhoto.projectName].filter(Boolean).join(" · ")}
          </div>
        </div>
      )}
    </main>
  )
}
