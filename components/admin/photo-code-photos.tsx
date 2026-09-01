"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crosshair,
  Download,
  FolderKanban,
  Globe2,
  Hash,
  ImageOff,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Smartphone,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authenticatedFetch } from "@/lib/client-auth"
import { getPhotoShareCopy } from "@/lib/photoShareI18n"
import { localeDateCode, resolveLocale, t } from "@/lib/i18n"

type PhotoCodePhotoRow = {
  photoID: string
  photoCode: string
  thumbnailURL: string | null
  captureTime: string
  timeZone: string
  userName: string | null
  projectName: string | null
  location: string | null
  team: { groupID: string; groupName: string }
  createdAt: string
}

type PhotoCodePhotosPayload = {
  photos: PhotoCodePhotoRow[]
  pagination: { page: number; pageSize: number; totalCount: number; totalPages: number }
  search: string
}

type PhotoCodePhotoDetail = {
  photoID: string
  photoCode: string
  imageURL: string | null
  downloadURL: string
  captureTime: string
  timestamp: number
  timeZone: string
  location: string | null
  latitude: number | null
  longitude: number | null
  positionType: string | null
  locationAccuracyMeters: number | null
  userName: string | null
  userEmail: string | null
  projectName: string | null
  team: { groupID: string; groupName: string }
  deviceModel: string | null
  os: string | null
  versionCode: string | null
  imageWidth: number | null
  imageHeight: number | null
  fileSize: number | null
  localPhotoName: string | null
  ossFileName: string
  createdAt: string
}

function formatDate(value: string, locale: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(localeDateCode(resolveLocale(locale)))
}

function formatFileSize(bytes: number | null) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-md px-2 py-2.5 hover:bg-white/[0.04]">
      <span className="mt-0.5 shrink-0 text-white/45">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] text-white/45">{label}</div>
        <div className="mt-0.5 break-words text-sm leading-5 text-white/90">{value || "-"}</div>
      </div>
    </div>
  )
}

export function PhotoCodePhotos({ token, locale, refreshKey }: { token: string; locale: string; refreshKey: number }) {
  const copy = getPhotoShareCopy(locale).copy
  const resolvedLocale = resolveLocale(locale)
  const title = resolvedLocale === "zh-Hans"
    ? "照片码照片"
    : resolvedLocale === "zh-Hant"
      ? "照片碼照片"
      : `${copy.photoCode} · ${t(locale, "dashboard.photos")}`
  const [payload, setPayload] = useState<PhotoCodePhotosPayload | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<PhotoCodePhotoDetail | null>(null)
  const [activePhotoID, setActivePhotoID] = useState<string | null>(null)
  const [error, setError] = useState("")
  const previewRef = useRef<HTMLDivElement>(null)

  const activePhotoList = useMemo(() => payload?.photos || [], [payload])
  const activePhotoIndex = activePhotoID
    ? activePhotoList.findIndex((photo) => photo.photoID === activePhotoID)
    : -1
  const previewPhotos = useMemo(() => {
    if (activePhotoIndex < 0) return []
    const previewSize = 21
    if (activePhotoList.length <= previewSize) return activePhotoList

    let start = Math.max(0, activePhotoIndex - 10)
    let end = Math.min(activePhotoList.length, start + previewSize)
    start = Math.max(0, end - previewSize)
    end = Math.min(activePhotoList.length, start + previewSize)
    return activePhotoList.slice(start, end)
  }, [activePhotoIndex, activePhotoList])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const url = new URL("/api/admin/photo-code-photos", window.location.origin)
      url.searchParams.set("page", String(page))
      url.searchParams.set("pageSize", "30")
      if (appliedSearch) url.searchParams.set("search", appliedSearch)
      const response = await authenticatedFetch(url.toString(), token, { headers: { "x-locale": locale } })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t(locale, "common.sendFailed"))
      setPayload(data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t(locale, "common.sendFailed"))
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, locale, page, refreshKey, token])

  useEffect(() => { void load() }, [load])

  const openDetail = useCallback(async (photoID: string) => {
    setActivePhotoID(photoID)
    setDetailLoading(true)
    setDetail(null)
    setError("")
    try {
      const response = await authenticatedFetch(`/api/admin/photo-code-photos/${encodeURIComponent(photoID)}`, token, {
        headers: { "x-locale": locale },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t(locale, "common.sendFailed"))
      setDetail(data.photo)
    } catch (requestError) {
      setActivePhotoID(null)
      setError(requestError instanceof Error ? requestError.message : t(locale, "common.sendFailed"))
    } finally {
      setDetailLoading(false)
    }
  }, [locale, token])

  const showAdjacentPhoto = useCallback((direction: -1 | 1) => {
    if (detailLoading || activePhotoIndex < 0) return
    const nextIndex = activePhotoIndex + direction
    if (nextIndex < 0 || nextIndex >= activePhotoList.length) return
    void openDetail(activePhotoList[nextIndex].photoID)
  }, [activePhotoIndex, activePhotoList, detailLoading, openDetail])

  useEffect(() => {
    if (!activePhotoID) return

    function handlePhotoKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const editing = target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName || "")
      if (editing) return

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        showAdjacentPhoto(-1)
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        showAdjacentPhoto(1)
      }
    }

    window.addEventListener("keydown", handlePhotoKeyDown)
    return () => window.removeEventListener("keydown", handlePhotoKeyDown)
  }, [activePhotoID, showAdjacentPhoto])

  useEffect(() => {
    if (!activePhotoID) return
    const selectedThumbnail = previewRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    selectedThumbnail?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [activePhotoID])

  function closeDetail() {
    setActivePhotoID(null)
    setDetail(null)
  }

  function submitSearch() {
    const normalized = search.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
    setSearch(normalized)
    setPage(1)
    setAppliedSearch(normalized)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Hash className="size-5" />{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.menuDetail}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} onKeyDown={(event) => { if (event.key === "Enter") submitSearch() }} placeholder={copy.photoCodePlaceholder} className="pl-9 font-mono" />
          </div>
          <Button variant="outline" size="icon" onClick={submitSearch} disabled={loading} title={copy.viewRecord}><Search className="size-4" /></Button>
          <Button variant="outline" size="icon" onClick={load} disabled={loading} title={t(locale, "dashboard.refresh")}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></Button>
        </div>
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr>
              <th className="w-20 px-4 py-3">{t(locale, "dashboard.photos")}</th>
              <th className="px-4 py-3">{copy.photoCode}</th>
              <th className="px-4 py-3">{copy.captureTime}</th>
              <th className="px-4 py-3">{copy.team}</th>
              <th className="px-4 py-3">{copy.project}</th>
              <th className="px-4 py-3">{t(locale, "dashboard.member")}</th>
              <th className="px-4 py-3">{t(locale, "dashboard.actions")}</th>
            </tr></thead>
            <tbody className="divide-y">
              {(payload?.photos || []).map((photo) => (
                <tr key={photo.photoID} className="hover:bg-muted/40">
                  <td className="px-4 py-2">{photo.thumbnailURL ? <img src={photo.thumbnailURL} alt="" className="size-12 rounded object-cover" loading="lazy" /> : <div className="flex size-12 items-center justify-center rounded bg-muted"><ImageOff className="size-5 text-muted-foreground" /></div>}</td>
                  <td className="px-4 py-3 font-mono font-medium">{photo.photoCode}</td>
                  <td className="px-4 py-3"><div>{photo.captureTime || formatDate(photo.createdAt, locale)}</div><div className="text-xs text-muted-foreground">{photo.timeZone}</div></td>
                  <td className="px-4 py-3">{photo.team.groupName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{photo.projectName || copy.none}</td>
                  <td className="px-4 py-3 text-muted-foreground">{photo.userName || "-"}</td>
                  <td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => void openDetail(photo.photoID)}>{t(locale, "dashboard.view")}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" />{t(locale, "common.loading")}</div>}
        {!loading && payload?.photos.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">{copy.none}</div>}
      </div>

      {payload && payload.pagination.totalCount > 0 && <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>{payload.pagination.page} / {payload.pagination.totalPages} · {payload.pagination.totalCount}</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => setPage(1)}>{t(locale, "dashboard.firstPage")}</Button>
          <Button size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t(locale, "dashboard.prevPage")}</Button>
          <Button size="sm" variant="outline" disabled={loading || page >= payload.pagination.totalPages} onClick={() => setPage((value) => Math.min(payload.pagination.totalPages, value + 1))}>{t(locale, "dashboard.nextPage")}</Button>
          <Button size="sm" variant="outline" disabled={loading || page >= payload.pagination.totalPages} onClick={() => setPage(payload.pagination.totalPages)}>{t(locale, "dashboard.lastPage")}</Button>
        </div>
      </div>}

      {activePhotoID && <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <Button variant="outline" onClick={closeDetail} className="border-white/20 bg-white text-black hover:bg-white/90">{t(locale, "web.close")}</Button>
          <span className="text-sm tabular-nums text-white/70">{activePhotoIndex + 1} / {activePhotoList.length}{detail?.photoCode ? ` · ${detail.photoCode}` : ""}</span>
          {detail ? <a href={detail.downloadURL} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-black hover:bg-white/90"><Download className="size-4" />{t(locale, "web.download")}</a> : <span />}
        </div>
        <div className="shrink-0 border-y border-white/10 bg-white/[0.03] px-3 py-2">
          <div ref={previewRef} className="flex h-16 items-center gap-2 overflow-x-auto overscroll-x-contain md:h-20">
            {previewPhotos.map((photo) => {
              const selected = photo.photoID === activePhotoID
              return <button
                key={photo.photoID}
                type="button"
                data-active={selected ? "true" : "false"}
                onClick={() => void openDetail(photo.photoID)}
                disabled={detailLoading}
                className={`flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-white/5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-wait md:size-16 ${selected ? "border-orange-400 opacity-100 shadow-[0_0_0_2px_rgba(251,146,60,0.25)]" : "border-transparent opacity-55 hover:opacity-90"}`}
                aria-label={photo.photoCode || t(locale, "dashboard.viewPhoto")}
                aria-current={selected ? "true" : undefined}
              >
                {photo.thumbnailURL ? <img src={photo.thumbnailURL} alt="" className="size-full object-cover" loading="lazy" /> : <ImageOff className="size-5 text-white/50" />}
              </button>
            })}
          </div>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center lg:px-20 lg:py-3">
          <button
            type="button"
            onClick={() => showAdjacentPhoto(-1)}
            disabled={detailLoading || activePhotoIndex <= 0}
            className="absolute left-5 top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-30 lg:flex"
            aria-label={t(locale, "dashboard.previousPhoto")}
          ><ChevronLeft className="size-6" /></button>
          <div className="flex min-h-0 w-full flex-1 flex-col lg:h-full lg:w-fit lg:max-w-[calc(100vw_-_10rem)] lg:flex-none lg:flex-row lg:items-stretch lg:justify-center">
          <div className="relative flex min-h-[240px] min-w-0 flex-1 items-center justify-center px-14 py-3 md:px-20 lg:contents">
            <button
              type="button"
              onClick={() => showAdjacentPhoto(-1)}
              disabled={detailLoading || activePhotoIndex <= 0}
              className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-30 md:left-5 md:size-12 lg:hidden"
              aria-label={t(locale, "dashboard.previousPhoto")}
            ><ChevronLeft className="size-6" /></button>
            {detailLoading ? <Loader2 className="size-8 animate-spin self-center text-white/70" /> : detail?.imageURL ? <img src={detail.imageURL} alt={detail.photoCode} className="max-h-full max-w-full self-center rounded-lg object-contain lg:max-w-[calc(100vw_-_30rem)]" /> : <ImageOff className="size-14 self-center text-white/40" />}
            <button
              type="button"
              onClick={() => showAdjacentPhoto(1)}
              disabled={detailLoading || activePhotoIndex < 0 || activePhotoIndex >= activePhotoList.length - 1}
              className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-30 md:right-5 md:size-12 lg:hidden"
              aria-label={t(locale, "dashboard.nextPhoto")}
            ><ChevronRight className="size-6" /></button>
          </div>
          {detailLoading ? <aside className="flex max-h-[38vh] min-h-0 w-full shrink-0 items-center justify-center border-t border-white/10 bg-white/[0.04] text-white/50 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0"><Loader2 className="size-6 animate-spin" /></aside> : detail && <aside className="max-h-[38vh] min-h-0 w-full shrink-0 overflow-y-auto border-t border-white/10 bg-white/[0.04] p-4 text-white lg:max-h-none lg:w-80 lg:border-l lg:border-t-0 lg:p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3"><Camera className="size-5 text-orange-400" /><h3 className="text-sm font-semibold">{copy.captureRecord}</h3></div>
            <DetailItem icon={<Users className="size-4" />} label={copy.photographer} value={[detail.userName, detail.userEmail].filter(Boolean).join(" · ") || "-"} />
            <DetailItem icon={<Clock3 className="size-4" />} label={copy.captureTime} value={detail.captureTime} />
            <DetailItem icon={<MapPin className="size-4" />} label={copy.captureLocation} value={detail.location || "-"} />
            <DetailItem icon={<Crosshair className="size-4" />} label={copy.gpsDetail} value={detail.latitude != null && detail.longitude != null ? `${detail.latitude.toFixed(6)}, ${detail.longitude.toFixed(6)}` : "-"} />
            {detail.locationAccuracyMeters != null && <DetailItem icon={<Crosshair className="size-4" />} label={copy.accuracy} value={`±${detail.locationAccuracyMeters} m`} />}
            <DetailItem icon={<FolderKanban className="size-4" />} label={copy.project} value={detail.projectName || copy.none} />
            <DetailItem icon={<Building2 className="size-4" />} label={copy.team} value={detail.team.groupName} />
            <DetailItem icon={<Smartphone className="size-4" />} label={copy.deviceModel} value={detail.deviceModel || "-"} />
            <DetailItem icon={<Smartphone className="size-4" />} label={copy.systemVersion} value={[detail.os, detail.versionCode].filter(Boolean).join(" · ") || "-"} />
            <DetailItem icon={<Camera className="size-4" />} label={copy.captureSource} value="Timeprint" />
            <DetailItem icon={<Globe2 className="size-4" />} label={copy.timezone} value={detail.timeZone || "-"} />
            <DetailItem icon={<Hash className="size-4" />} label={copy.photoCode} value={detail.photoCode} />
            {(detail.imageWidth != null || detail.imageHeight != null) && <DetailItem icon={<ImageOff className="size-4" />} label={copy.photoContent} value={`${detail.imageWidth || "-"} × ${detail.imageHeight || "-"} px · ${formatFileSize(detail.fileSize)}`} />}
          </aside>}
          </div>
          <button
            type="button"
            onClick={() => showAdjacentPhoto(1)}
            disabled={detailLoading || activePhotoIndex < 0 || activePhotoIndex >= activePhotoList.length - 1}
            className="absolute right-5 top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-30 lg:flex"
            aria-label={t(locale, "dashboard.nextPhoto")}
          ><ChevronRight className="size-6" /></button>
        </div>
      </div>}
    </div>
  )
}
