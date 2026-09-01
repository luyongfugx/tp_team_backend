"use client"

import { useEffect, useRef, useState } from "react"
import {
  Camera,
  CheckCircle2,
  Clock3,
  Crosshair,
  FolderKanban,
  Globe2,
  Hash,
  Image as ImageIcon,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Upload,
  Users,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authenticatedFetch } from "@/lib/client-auth"
import { getPhotoShareCopy } from "@/lib/photoShareI18n"

type Stage = { key: string; status: string }
type CaptureRecord = {
  photoCode?: string | null
  captureTime?: string | null
  address?: string | null
  latlng?: string | null
  positionType?: string | null
  locationAccuracyMeters?: number | null
  groupName?: string | null
  projectName?: string | null
  deviceModel?: string | null
  os?: string | null
  versionCode?: string | null
  timezoneAbbreviation?: string | null
  timezoneID?: string | null
  captureSource?: string | null
}
type SectionResult = {
  verified?: boolean | null
  expected?: string | null
  similarity?: number | null
  threshold?: number | null
  reason?: string | null
  regions?: Array<{ recognized?: string | null; recognizedDate?: string | null; recognizedTime?: string | null }>
}
type VerificationResult = {
  verified: boolean
  photoCode?: { recognized?: string | null; matched?: boolean | null }
  time?: SectionResult
  address?: SectionResult
  content?: { verified?: boolean | null; reason?: string | null }
  captureRecord?: CaptureRecord
  errorCode?: string | null
  errorMessage?: string | null
}
type VerificationTask = {
  taskID: string
  status: string
  imageUrl?: string | null
  photoCode?: string | null
  verified?: boolean | null
  result?: VerificationResult | null
  errorCode?: string | null
  errorMessage?: string | null
  progress?: { currentStage?: string | null; stages?: Stage[] } | null
}
type PhotoRecordResponse = { photoCode: string; captureRecord: CaptureRecord }

const MAX_UPLOAD_BYTES = 800 * 1024

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
}

async function compressVerificationImage(file: File) {
  const objectURL = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error("image-decode-failed"))
      element.src = objectURL
    })
    const maximumDimension = 2400
    let scale = Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight))
    for (let resizeAttempt = 0; resizeAttempt < 7; resizeAttempt += 1) {
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext("2d")
      if (!context) throw new Error("canvas-unavailable")
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (let quality = 0.92; quality >= 0.4; quality -= 0.08) {
        const blob = await canvasBlob(canvas, quality)
        if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob
      }
      scale *= 0.82
    }
    return null
  } finally {
    URL.revokeObjectURL(objectURL)
  }
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function verificationFailureMessage(task: VerificationTask, fallback: string, recordNotFound: string) {
  const message = task.errorMessage?.trim() || ""
  if (message.toLowerCase().includes("cos object not found")) return recordNotFound
  return message || fallback
}

function DetailRow({ icon, label, value, verified }: { icon: React.ReactNode; label: string; value: string; verified?: boolean | null }) {
  return (
    <div className="flex gap-3 border-b py-3 last:border-b-0">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{label}</span>
          {verified === true && <CheckCircle2 className="size-4 text-emerald-600" />}
          {verified === false && <XCircle className="size-4 text-destructive" />}
        </div>
        <div className="mt-1 break-words text-sm font-medium">{value || "-"}</div>
      </div>
    </div>
  )
}

function CaptureRecordView({ record, photoCode, locale }: { record: CaptureRecord; photoCode: string; locale: string }) {
  const copy = getPhotoShareCopy(locale).copy
  const systemVersion = [record.os, record.versionCode].filter(Boolean).join(" · ") || "-"
  return (
    <div className="grid gap-x-8 md:grid-cols-2">
      <DetailRow icon={<Hash className="size-4" />} label={copy.photoCode} value={photoCode || record.photoCode || "-"} />
      <DetailRow icon={<Clock3 className="size-4" />} label={copy.captureTime} value={record.captureTime || "-"} />
      <DetailRow icon={<MapPin className="size-4" />} label={copy.captureLocation} value={record.address || "-"} />
      <DetailRow icon={<Crosshair className="size-4" />} label={copy.gpsDetail} value={record.latlng || "-"} />
      {record.positionType && <DetailRow icon={<MapPin className="size-4" />} label={copy.positionType} value={record.positionType} />}
      {record.locationAccuracyMeters != null && <DetailRow icon={<Crosshair className="size-4" />} label={copy.accuracy} value={`±${record.locationAccuracyMeters} m`} />}
      <DetailRow icon={<FolderKanban className="size-4" />} label={copy.project} value={record.projectName || copy.none} />
      <DetailRow icon={<Users className="size-4" />} label={copy.team} value={record.groupName || copy.none} />
      <DetailRow icon={<Smartphone className="size-4" />} label={copy.deviceModel} value={record.deviceModel || "-"} />
      <DetailRow icon={<Smartphone className="size-4" />} label={copy.systemVersion} value={systemVersion} />
      <DetailRow icon={<Camera className="size-4" />} label={copy.captureSource} value={record.captureSource || "Timeprint"} />
      <DetailRow icon={<Globe2 className="size-4" />} label={copy.timezone} value={record.timezoneAbbreviation || record.timezoneID || "-"} />
    </div>
  )
}

export function PhotoVerification({ token, locale, refreshKey }: { token: string; locale: string; refreshKey: number }) {
  const copy = getPhotoShareCopy(locale).copy
  const fileInputRef = useRef<HTMLInputElement>(null)
  const generationRef = useRef(0)
  const [previewURL, setPreviewURL] = useState("")
  const [task, setTask] = useState<VerificationTask | null>(null)
  const [record, setRecord] = useState<PhotoRecordResponse | null>(null)
  const [photoCode, setPhotoCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  function reset() {
    generationRef.current += 1
    if (previewURL) URL.revokeObjectURL(previewURL)
    setPreviewURL("")
    setTask(null)
    setRecord(null)
    setError("")
    setBusy(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  useEffect(() => reset(), [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { generationRef.current += 1 }, [])
  useEffect(() => () => { if (previewURL) URL.revokeObjectURL(previewURL) }, [previewURL])

  async function requestJSON(url: string, init: RequestInit) {
    const response = await authenticatedFetch(url, token, {
      ...init,
      headers: { ...init.headers, "x-locale": locale },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || copy.failedMessage)
    return data
  }

  async function pollTask(initialTask: VerificationTask, generation: number) {
    let current = initialTask
    for (let attempt = 0; attempt <= 30; attempt += 1) {
      if (generationRef.current !== generation) return
      setTask(current)
      if (current.status === "SUCCEEDED") return
      if (current.status === "FAILED") {
        throw new Error(verificationFailureMessage(current, copy.failedMessage, copy.recordNotFound))
      }
      if (attempt === 30) {
        await requestJSON("/api/photoCode/verify/task/timeout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskID: current.taskID }),
        }).catch(() => {})
        throw new Error(copy.timeout)
      }
      await delay(2000)
      current = await requestJSON("/api/photoCode/verify/task/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskID: current.taskID }),
      }) as VerificationTask
    }
  }

  async function verifyFile(file: File) {
    reset()
    const generation = generationRef.current
    const localPreview = URL.createObjectURL(file)
    setPreviewURL(localPreview)
    setBusy(true)
    try {
      const compressed = await compressVerificationImage(file)
      if (!compressed) throw new Error(copy.compressionFailed)
      const form = new FormData()
      form.set("image", new File([compressed], "verification.jpg", { type: "image/jpeg" }))
      const upload = await requestJSON("/api/photoCode/verify/upload", { method: "POST", body: form })
      const created = await requestJSON("/api/photoCode/verify/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: upload.imageUrl }),
      }) as VerificationTask
      await pollTask(created, generation)
    } catch (requestError) {
      if (generationRef.current === generation) setError(requestError instanceof Error ? requestError.message : copy.failedMessage)
    } finally {
      if (generationRef.current === generation) setBusy(false)
    }
  }

  async function lookupRecord() {
    const normalized = photoCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
    setPhotoCode(normalized)
    setTask(null)
    setRecord(null)
    setError("")
    if (normalized.length !== 12) {
      setError(copy.invalidPhotoCode)
      return
    }
    setBusy(true)
    try {
      const data = await requestJSON("/api/photoCode/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoCode: normalized }),
      }) as PhotoRecordResponse
      setRecord(data)
    } catch {
      setError(copy.recordNotFound)
    } finally {
      setBusy(false)
    }
  }

  const result = task?.status === "SUCCEEDED" ? task.result : null
  const stages = task?.progress?.stages || []
  const stageLabels: Record<string, string> = {
    PHOTO_CODE: copy.photoCode,
    TIME: copy.captureTime,
    ADDRESS: copy.captureLocation,
    PHOTO_INFO: copy.photoContent,
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck className="size-5" />{copy.trustQuestion}</h2>
        <p className="mt-1 max-w-3xl whitespace-pre-line text-sm text-muted-foreground">{copy.trustSubtitle}</p>
      </div>

      {!result && !record && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
            <section className="flex min-h-80 flex-col items-center justify-center gap-4 p-6 text-center lg:border-r lg:p-10">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void verifyFile(file) }} />
              {previewURL ? (
                <img src={previewURL} alt={copy.uploadedPhoto} className="max-h-64 max-w-full rounded-md object-contain" />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-full bg-orange-50 text-orange-600"><ImageIcon className="size-9" /></div>
              )}
              {busy ? (
                <div className="w-full max-w-md space-y-4">
                  <div className="flex items-center justify-center gap-2 font-medium"><Loader2 className="size-5 animate-spin text-orange-600" />{copy.checkingTitle}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(stages.length ? stages : ["PHOTO_CODE", "TIME", "ADDRESS", "PHOTO_INFO"].map((key) => ({ key, status: "PENDING" }))).map((stage) => (
                      <div key={stage.key} className={`rounded-md border px-2 py-2 text-xs ${stage.status === "COMPLETED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : stage.status === "RUNNING" ? "border-orange-300 bg-orange-50 text-orange-700" : stage.status === "FAILED" ? "border-red-200 bg-red-50 text-red-700" : "text-muted-foreground"}`}>
                        {stage.status === "RUNNING" && <Loader2 className="mx-auto mb-1 size-4 animate-spin" />}
                        {stage.status === "COMPLETED" && <CheckCircle2 className="mx-auto mb-1 size-4" />}
                        {stage.status === "FAILED" && <XCircle className="mx-auto mb-1 size-4" />}
                        {stageLabels[stage.key] || stage.key}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Button onClick={() => fileInputRef.current?.click()} className="bg-orange-600 text-white hover:bg-orange-700">
                  <Upload className="size-4" />{previewURL ? copy.changePhoto : copy.selectPhoto}
                </Button>
              )}
            </section>

            <section className="flex flex-col justify-center border-t p-6 lg:border-t-0 lg:p-8">
              <div className="mb-1 flex items-center gap-2 font-semibold"><Hash className="size-5 text-orange-600" />{copy.havePhotoCode}</div>
              <p className="mb-4 text-sm text-muted-foreground">{copy.photoCodeHint}</p>
              <Input
                value={photoCode}
                onChange={(event) => setPhotoCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
                onKeyDown={(event) => { if (event.key === "Enter") void lookupRecord() }}
                placeholder={copy.photoCodePlaceholder}
                maxLength={12}
                className="font-mono uppercase tracking-widest"
              />
              <Button variant="outline" className="mt-3" onClick={lookupRecord} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}{copy.viewRecord}
              </Button>
            </section>
          </div>
        </div>
      )}

      {error && <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><XCircle className="mt-0.5 size-4 shrink-0" /><div><div className="font-medium">{copy.failedTitle}</div><div className="mt-1">{error}</div></div></div>}

      {result && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className={`flex items-center justify-between gap-4 border-b p-5 ${result.verified ? "bg-emerald-50" : "bg-red-50"}`}>
            <div><div className="text-sm text-muted-foreground">{copy.resultTitle}</div><div className={`mt-1 flex items-center gap-2 text-xl font-semibold ${result.verified ? "text-emerald-700" : "text-red-700"}`}>{result.verified ? <CheckCircle2 className="size-6" /> : <XCircle className="size-6" />}{result.verified ? copy.verified : copy.notVerified}</div></div>
            <Button variant="outline" onClick={reset}><RotateCcw className="size-4" />{copy.changePhoto}</Button>
          </div>
          <div className="grid lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
            <div className="flex items-center justify-center bg-black/95 p-4"><img src={previewURL || task?.imageUrl || ""} alt={copy.uploadedPhoto} className="max-h-[520px] max-w-full object-contain" /></div>
            <div className="p-5 lg:p-7">
              <h3 className="mb-2 font-semibold">{copy.verificationDetails}</h3>
              <DetailRow icon={<Hash className="size-4" />} label={copy.photoCode} value={result.photoCode?.recognized || task?.photoCode || "-"} verified={result.photoCode?.matched} />
              <DetailRow icon={<Clock3 className="size-4" />} label={copy.captureTime} value={result.time?.expected || result.captureRecord?.captureTime || "-"} verified={result.time?.verified} />
              <DetailRow icon={<MapPin className="size-4" />} label={copy.captureLocation} value={result.address?.expected || result.captureRecord?.address || "-"} verified={result.address?.verified} />
              <DetailRow icon={<ImageIcon className="size-4" />} label={copy.photoContent} value={result.content?.reason || (result.content?.verified ? copy.contentMatched : copy.contentMismatched)} verified={result.content?.verified} />
              {result.captureRecord && <div className="mt-6 border-t pt-5"><h3 className="mb-2 font-semibold">{copy.captureRecord}</h3><CaptureRecordView record={result.captureRecord} photoCode={result.photoCode?.recognized || task?.photoCode || ""} locale={locale} /></div>}
            </div>
          </div>
        </div>
      )}

      {record && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-4 border-b bg-emerald-50 p-5">
            <div><div className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 className="size-5" />{copy.recordFoundTitle}</div><p className="mt-1 text-sm text-emerald-800/70">{copy.recordFoundBody}</p></div>
            <Button variant="outline" onClick={reset}><RotateCcw className="size-4" />{copy.viewRecord}</Button>
          </div>
          <div className="p-5 lg:p-7"><h3 className="mb-2 font-semibold">{copy.captureRecord}</h3><CaptureRecordView record={record.captureRecord} photoCode={record.photoCode} locale={locale} /></div>
        </div>
      )}
    </div>
  )
}
