"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, ChevronRight, Copy, ImageIcon, Info, LoaderCircle, MapPin, RotateCcw, Share2, ShieldQuestion, TriangleAlert, X } from "lucide-react"
import type { PhotoShareCopy } from "@/lib/photoShareI18n"
import type { VerificationReport, VerificationCheck } from "@/lib/verificationReport"
import styles from "./report.module.css"
import CaptureRecord from "./capture-record"

type Props = { report: VerificationReport; copy: PhotoShareCopy; locale: string; direction: "ltr" | "rtl"; embedded: boolean; theme: string; captureTime: string; captureDate: string; captureClock: string; completedTime: string; sample?: boolean; legacy?: boolean; websiteOrigin?: string }

function nativeAction(action: string, value?: string) {
  const bridge = (window as unknown as { webkit?: { messageHandlers?: { timeprintVerification?: { postMessage: (value: unknown) => void } } } }).webkit?.messageHandlers?.timeprintVerification
  if (!bridge) return false
  bridge.postMessage({ action, value }); return true
}

export default function VerificationReportPage({ report, copy: c, locale, direction, embedded, theme, captureTime, captureDate, captureClock, completedTime, sample = false, legacy = false, websiteOrigin = "https://www.timeprint.net" }: Props) {
  const [zoom, setZoom] = useState(false)
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  const [shareFallback, setShareFallback] = useState<string | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [loadedImage, setLoadedImage] = useState<string | null>(null)
  const [nativePreview, setNativePreview] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const r = report, record = r.mode === "record", capture = r.capture
  const authenticRecord = record && r.state === "record" && capture !== null
  const imageURL = nativePreview || r.imageUrl
  const retry = r.state === "error" || r.state === "processing"
  const ready = !["not_found", "error", "processing"].includes(r.state)
  const showClearPhotoHint = !record && ["partial", "unavailable", "unsupported"].includes(r.state)
  const shareable = r.taskID !== null || (record && capture !== null) || (sample && ready)
  const title = ({ passed: c.passedTitle, mismatch: c.warningTitle, partial: c.partialTitle, unavailable: c.unableTitle,
    unsupported: c.unableTitle, processing: c.checkingTitle, error: c.unableTitle, record: c.recordFoundTitle,
    not_found: record ? c.recordNotFound : c.reportNotFound })[r.state]
  const description = ({ passed: c.passedBody, mismatch: c.warningBody, partial: c.partialBody,
    unavailable: r.reason === "reference_missing" ? c.referenceMissing : c.unreadable,
    unsupported: c.otherCamera, processing: c.loading, error: c.serviceError, record: c.recordLookupTip, not_found: "" })[r.state]
  const HeroIcon = r.state === "passed" ? Check : authenticRecord ? Info : r.state === "mismatch" ? TriangleAlert : r.state === "processing" ? LoaderCircle : ShieldQuestion
  const tone = r.state === "passed" ? "passed" : r.state === "mismatch" ? "mismatch" : "neutral"
  const labels = { code: c.photoCode, time: c.captureTime, address: c.captureLocation, content: c.photoContent }
  const visibleChecks = r.checks
  const checkLabel = (item: VerificationCheck) => ({ passed: c.match, mismatch: c.mismatch, unavailable: c.unavailable, not_checked: c.notChecked })[item.state]
  const reasonLabel = (item: VerificationCheck) => ({ match: c.match, difference: c.mismatch, unreadable: c.unreadable, reference_missing: c.referenceMissing, not_checked: c.notChecked })[item.reason]

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)")
    const update = () => setCanShare(typeof navigator.share === "function" && query.matches)
    update(); query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  useEffect(() => {
    if (!embedded) return
    nativeAction("appearance", JSON.stringify({ locale, direction, title: c.reportTitle }))
    nativeAction("ready")
  }, [embedded, locale, direction, c.reportTitle])
  useEffect(() => {
    if (zoom) dialogRef.current?.showModal(); else dialogRef.current?.close()
  }, [zoom])
  useEffect(() => {
    // A cached image can finish before hydration attaches its load handlers.
    const image = imageRef.current
    if (!image?.complete) return
    if (image.naturalWidth) setLoadedImage(imageURL)
    else setImageFailed(true)
  }, [imageURL])
  useEffect(() => {
    if (!embedded || record) return
    const apply = (value: unknown) => {
      if (typeof value === "string" && value.startsWith("data:image/jpeg;base64,")) { setNativePreview(value); setImageFailed(false) }
    }
    apply((window as unknown as { timeprintVerificationPreview?: string }).timeprintVerificationPreview)
    const listener = (event: Event) => apply((event as CustomEvent).detail)
    window.addEventListener("timeprintVerificationPhoto", listener)
    return () => window.removeEventListener("timeprintVerificationPhoto", listener)
  }, [embedded, record])
  useEffect(() => {
    if (r.state !== "processing") return
    const timeout = setTimeout(() => window.location.reload(), 5000)
    return () => clearTimeout(timeout)
  }, [r.state])

  function canonicalURL() {
    const url = new URL(window.location.href)
    url.searchParams.delete("embed"); url.searchParams.delete("theme"); url.searchParams.delete("legacy")
    return url.toString()
  }
  async function share() {
    if (embedded && nativeAction("share")) return
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) { await navigator.share({ title: c.reportTitle, url: canonicalURL() }); return }
      if (navigator.clipboard) { await navigator.clipboard.writeText(canonicalURL()); setCopied(true); setTimeout(() => setCopied(false), 1800); return }
    } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return }
    setShareFallback(canonicalURL())
  }
  function selectPhoto() {
    if (embedded && nativeAction("select")) return
    window.location.href = `${websiteOrigin}/${locale}/photo-verification`
  }
  async function copyCode() {
    if (embedded && nativeAction("copy", r.photoCode)) { setCopied(true); setTimeout(() => setCopied(false), 1800); return }
    try { await navigator.clipboard.writeText(r.photoCode); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { setShareFallback(r.photoCode) }
  }
  const gps = capture?.latitude !== null && capture?.latitude !== undefined && capture.longitude !== null
    ? `${capture.latitude.toFixed(6)}, ${capture.longitude.toFixed(6)}` : ""
  const metadata = capture ? record ? [
    [c.captureSource, capture.source], [c.deviceModel, capture.deviceModel || "—"],
    [c.time, captureClock], [c.date, captureDate], [c.timezone, capture.timezone],
    [c.gps, gps || "—"], [c.captureLocation, capture.address || "—"],
    [c.appVersion, capture.appVersion], [c.systemVersion, capture.os],
  ].filter(([, value]) => value) : [
    [c.captureTime, captureTime], [c.timezone, capture.timezone], [c.captureLocation, capture.address],
    [c.gps, gps],
    [c.accuracy, capture.accuracy !== null && capture.accuracy >= 0 ? `±${Math.round(capture.accuracy)} m` : ""],
    [c.captureSource, capture.source], [c.appVersion, capture.appVersion], [c.deviceModel, capture.deviceModel], [c.systemVersion, capture.os],
  ].filter(([, value]) => value) : []
  const mapURL = capture?.latitude !== null && capture?.latitude !== undefined && capture.longitude !== null
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${capture.latitude},${capture.longitude}`)}` : null

  return <div className={styles.page} data-theme={theme} data-embedded={embedded} lang={locale} dir={direction} data-report-state={r.state} data-record-page={authenticRecord}>
    <div className={styles.container}>
      <header className={styles.brandBar}>
        <div className={styles.brand} dir="ltr"><img src="/logo.png" alt="" width="34" height="34" /><span>Timeprint</span></div>
        {authenticRecord && <button className={styles.recordShare} onClick={share} aria-label={c.share}><Share2 size={18} /><span>{(embedded || canShare) ? c.share : c.copyLink}</span>{copied && <Check size={16} />}</button>}
      </header>
      {sample && <aside className={styles.notice} role="note"><strong dir="auto">{c.sampleLabel}</strong><span dir="auto">{c.sampleNotice}</span></aside>}
      {legacy && <p className={styles.notice} dir="auto">{c.legacyNotice}</p>}
      <main>
        {authenticRecord ? <>
          <CaptureRecord capture={capture} photoCode={r.photoCode} copy={c} date={captureDate} time={captureClock} copied={copied} onCopy={copyCode} onVerify={selectPhoto} />
          <span className={styles.visuallyHidden} role="status">{copied ? c.copied : ""}</span>
          {shareFallback && <input className={styles.shareLink} aria-label={c.share} dir="ltr" readOnly value={shareFallback} onFocus={e => e.target.select()} />}
        </> : <div className={styles.reportCard} data-tone={tone} data-record-result={authenticRecord}>
        <section className={`${styles.hero} ${styles[tone]}`} aria-labelledby="report-title">
          <div className={styles.heroIcon}><HeroIcon size={34} strokeWidth={2.2} className={r.state === "processing" ? styles.spinning : ""} /></div>
          <div className={styles.heroCopy}><p className={styles.eyebrow} dir="auto">{c.resultLabel}</p><h1 id="report-title" dir="auto">{title}</h1></div>
          {shareable && <button className={styles.iconButton} onClick={share} aria-label={record ? c.share : c.shareResult}><Share2 size={24} /></button>}
        </section>
        <div className={styles.resultSummary}>
          {showClearPhotoHint && <p className={styles.recoveryHint} dir="auto">{c.clearPhotoHint}</p>}
          {description && r.state !== "passed" && !(r.state === "unavailable" && r.reason !== "reference_missing") && <p dir="auto">{description}</p>}
        </div>

        <div className={`${styles.actions} ${styles.desktopActions}`}>
          {retry ? <button className={styles.primary} onClick={() => location.reload()}><RotateCcw size={18}/>{c.retry}</button> : <button className={styles.primary} onClick={selectPhoto}><ImageIcon size={18}/>{record ? c.uploadToVerify : c.changePhoto}</button>}
          {shareable && <button className={styles.secondary} onClick={share}><Share2 size={18}/>{(embedded || canShare) ? c.shareResult : c.copyLink}{copied && <Check size={16}/>}</button>}
        </div>
        <div className={styles.workspace}>
        {!record && r.checks.length > 0 && !["processing", "unsupported"].includes(r.state) && <section className={styles.checks} aria-label={c.verificationDetails}>
          <h2>{c.verificationDetails}</h2>
          <div className={styles.checkList}>{visibleChecks.map(item => {
            const Icon = item.state === "passed" ? Check : item.state === "mismatch" ? TriangleAlert : Info
            return <details key={item.key} className={styles.check} open={item.state === "mismatch"}>
              <summary><span className={`${styles.fieldIcon} ${styles[item.state]}`}><Icon size={15} /></span><span className={styles.checkTitle}>{labels[item.key]}</span><span className={`${styles.badge} ${styles[item.state]}`}>{checkLabel(item)}</span><ChevronDown size={15} className={styles.chevron} /></summary>
              <div className={styles.checkDetails}>
                {item.expected && <div><span>{c.comparisonRecord}</span><p dir="auto">{item.expected}</p></div>}
                {item.recognized && <div><span>{c.comparisonImage}</span><p dir="auto">{item.recognized}</p></div>}
                <p className={styles.reason}>{reasonLabel(item)}</p>
              </div>
            </details>
          })}</div>
        </section>}

        <div className={styles.captureGrid} data-paired={Boolean((imageURL || r.imageUnavailable) && capture)}>
        {(imageURL || r.photoCode || r.imageUnavailable) && <section className={styles.photoCard}>
          {imageURL && !imageFailed && <button className={styles.photoButton} onClick={() => setZoom(true)} aria-label={c.tapLargeImage} aria-busy={loadedImage !== imageURL}>
            <img ref={imageRef} src={imageURL} alt={c.uploadedPhoto} decoding="async" onLoad={() => setLoadedImage(imageURL)} onError={() => setImageFailed(true)} />
            {loadedImage !== imageURL && <i className={styles.imageLoading} aria-hidden="true"><LoaderCircle size={28} className={styles.spinning} /></i>}
            <span><ImageIcon size={14} />{c.tapLargeImage}</span>
          </button>}
          {(imageFailed || (r.imageUnavailable && !nativePreview)) && <p className={styles.imageError}><ImageIcon size={24} />{c.imageUnavailable}</p>}
          {r.photoCode && <button className={styles.codeBar} onClick={copyCode} aria-label={`${c.photoCode}: ${r.photoCode}`}><span>{c.photoCode}</span><strong dir="ltr">{r.photoCode}</strong>{copied ? <Check size={17} /> : <Copy size={17} />}</button>}
        </section>}

        {capture && <section className={styles.recordCard} data-original-info><h2>{c.originalInfo}</h2><dl className={styles.metadata}>
          {metadata.filter(([label]) => ![c.captureSource, c.appVersion, c.deviceModel, c.systemVersion].includes(label)).map(([label, value]) => <div key={label}><dt>{label}</dt><dd><bdi dir={[c.gps, c.accuracy, c.appVersion].includes(label) ? "ltr" : "auto"}>{value}</bdi></dd></div>)}
        </dl><details className={styles.deviceDetails}><summary>{c.deviceSource}</summary><dl className={styles.metadata}>{metadata.filter(([label]) => [c.captureSource, c.appVersion, c.deviceModel, c.systemVersion].includes(label)).map(([label, value]) => <div key={label}><dt>{label}</dt><dd dir="auto">{value}</dd></div>)}</dl></details>{mapURL && <a className={styles.mapLink} href={mapURL} target="_blank" rel="noreferrer"><MapPin size={19}/><span>{c.navigate}</span><ChevronRight size={18}/></a>}</section>}
        </div>

        </div>
        {completedTime && <p className={styles.timestamp}>{c.completedAt} · <bdi>{completedTime}</bdi></p>}
        <div className={`${styles.actions} ${styles.mobileActions}`}>
          {retry ? <button className={styles.primary} onClick={() => location.reload()}><RotateCcw size={18}/>{c.retry}</button> : <button className={styles.primary} onClick={selectPhoto}><ImageIcon size={18}/>{record ? c.uploadToVerify : c.changePhoto}</button>}
          {shareable && <button className={styles.secondary} onClick={share}><Share2 size={18}/>{(embedded || canShare) ? c.shareResult : c.copyLink}{copied && <Check size={16}/>}</button>}
        </div>
        <span className={styles.visuallyHidden} role="status">{copied ? c.copied : ""}</span>
        {shareFallback && <input className={styles.shareLink} aria-label={c.share} dir="ltr" readOnly value={shareFallback} onFocus={e => e.target.select()} />}
        </div>}
        {ready && <section className={styles.about} aria-labelledby="trust-title">
          <h2 id="trust-title" dir="auto">{c.trustTitle}</h2>
          <div className={styles.trustGrid}>{[[c.trust1Title, c.trust1Body], [c.trust2Title, c.trust2Body], [c.trust3Title, c.trust3Body]].map(([heading, body], index) =>
            <article className={styles.trustCard} key={index}>
              <h3><span className={styles.trustNumber} aria-hidden="true" dir="ltr">{String(index + 1).padStart(2, "0")}</span><span dir="auto">{heading}</span></h3>
              <p dir="auto">{body}</p>
            </article>
          )}</div>
        </section>}
      </main>
      <footer className={styles.footer}>Timeprint <span>·</span> {c.reportTitle}</footer>
    </div>
    <dialog ref={dialogRef} className={styles.imageDialog} aria-label={c.uploadedPhoto} onClose={() => setZoom(false)} onClick={e => { if (e.target === e.currentTarget) setZoom(false) }}><button onClick={() => setZoom(false)} aria-label={c.close}><X size={26}/></button>{zoom && imageURL && <img src={imageURL} alt={c.uploadedPhoto} decoding="async"/>}</dialog>
  </div>
}
