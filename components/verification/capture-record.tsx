"use client"

import { Check, ChevronRight, Copy, ImageIcon, Info, MapPin, Navigation } from "lucide-react"
import type { PhotoShareCopy } from "@/lib/photoShareI18n"
import type { VerificationReport } from "@/lib/verificationReport"
import CaptureMap from "./capture-map"
import styles from "./record.module.css"

type Props = {
  capture: NonNullable<VerificationReport["capture"]>; photoCode: string; copy: PhotoShareCopy
  date: string; time: string; copied: boolean; onCopy: () => void; onVerify: () => void
}

export default function CaptureRecord({ capture, photoCode, copy: c, date, time, copied, onCopy, onVerify }: Props) {
  const hasGPS = capture.latitude !== null && capture.longitude !== null
  const gps = hasGPS ? `${capture.latitude!.toFixed(6)}, ${capture.longitude!.toFixed(6)}` : "—"
  const mapURL = hasGPS ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${capture.latitude},${capture.longitude}`)}` : null
  const metadata = [
    [c.time, time], [c.date, date], [c.timezone, capture.timezone || "—"],
    [c.deviceModel, capture.deviceModel || "—"], [c.captureSource, capture.source],
    [c.appVersion, capture.appVersion], [c.systemVersion, capture.os],
  ].filter(([, value]) => value)

  return <div className={styles.record}>
    <section className={styles.card} aria-labelledby="location-title" data-capture-location>
      <div className={styles.sectionHeading}><MapPin size={21} /><h1 id="location-title">{c.location}</h1></div>
      {hasGPS ? <CaptureMap latitude={capture.latitude!} longitude={capture.longitude!} label={c.location} unavailable={c.unavailable} />
        : <div className={styles.emptyMap}><MapPin size={28} /><span>{c.gps} · {c.unavailable}</span></div>}
      <div className={styles.locationDetails}>
        <p className={styles.address} dir="auto">{capture.address || "—"}</p>
        <div className={styles.locationFooter}>
          <dl className={styles.coordinates}><div><dt>{c.gps}</dt><dd><bdi dir="ltr">{gps}</bdi></dd></div>
            {capture.accuracy !== null && capture.accuracy >= 0 && <div><dt>{c.accuracy}</dt><dd><bdi dir="ltr">±{Math.round(capture.accuracy)} m</bdi></dd></div>}
          </dl>
          {mapURL && <a className={styles.navigation} href={mapURL} target="_blank" rel="noreferrer"><Navigation size={17} /><span>{c.navigate}</span><ChevronRight size={17} /></a>}
        </div>
      </div>
    </section>

    <section className={`${styles.card} ${styles.information}`} aria-labelledby="metadata-title" data-original-info>
      <h2 id="metadata-title">{c.originalInfo}</h2>
      <button className={styles.photoCode} onClick={onCopy} aria-label={`${c.photoCode}: ${photoCode}`}>
        <span>{c.photoCode}</span><strong dir="ltr">{photoCode}</strong>{copied ? <Check size={18} /> : <Copy size={18} />}
      </button>
      <dl className={styles.metadata}>{metadata.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><bdi dir="auto">{value}</bdi></dd></div>)}</dl>
      <p className={styles.recordNote}><Info size={16} /><span>{c.recordFoundTitle}</span></p>
    </section>

    <section className={`${styles.card} ${styles.verify}`} aria-labelledby="verify-title">
      <div className={styles.verifyIcon}><ImageIcon size={25} /></div>
      <div className={styles.verifyCopy}><h2 id="verify-title">{c.menuTitle}</h2><p>{c.recordLookupTip}</p></div>
      <button className={styles.verifyButton} onClick={onVerify}>{c.uploadToVerify}<ChevronRight size={18} /></button>
    </section>
  </div>
}
