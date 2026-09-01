import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import {
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  Crosshair,
  Folder,
  Globe2,
  Hash,
  Image as ImageIcon,
  MapPin,
  Navigation,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react"
import { getPublicPhotoShare, normalizePublicPhotoCode } from "@/lib/publicPhotoShare"
import { getPhotoShareCopy } from "@/lib/photoShareI18n"
import styles from "./page.module.css"

export const dynamic = "force-dynamic"

const APP_STORE_URL = "https://apps.apple.com/us/app/timeprint-timestamp-gps-camera/id6480020509"
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.timestampcamerafree.gpsmapcameratimemark.geotagginglocationonphoto"

type PageProps = { params: Promise<{ photoCode: string }> }

function storeURLForUserAgent(userAgent: string) {
  if (/android/i.test(userAgent)) return GOOGLE_PLAY_URL
  if (/(iphone|ipad|ipod|macintosh|mac os x)/i.test(userAgent)) return APP_STORE_URL
  return "#download"
}

function displayDateTime(value: string, timestamp: number | null, locale: string) {
  if (value) return value
  if (!timestamp) return "—"
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(timestamp))
  } catch {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(timestamp))
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { photoCode } = await params
  const share = await getPublicPhotoShare(photoCode)
  if (!share) return { title: "Photo record not found | Timeprint", robots: { index: false, follow: false } }
  const requestHeaders = await headers()
  const { copy } = getPhotoShareCopy(requestHeaders.get("accept-language") ?? "")
  const description = [share.captureTime, share.address].filter(Boolean).join(" · ") || "Timeprint verified photo record"
  return {
    title: `${share.photoCode} | ${copy.verifyTitle}`,
    description,
    robots: { index: false, follow: false, nocache: true },
    openGraph: {
      type: "website",
      title: share.verified ? copy.verified : copy.inconsistent,
      description,
      images: share.imageUrl ? [{ url: share.imageUrl }] : [],
    },
  }
}

export default async function PhotoCodeSharePage({ params }: PageProps) {
  const { photoCode: rawPhotoCode } = await params
  const photoCode = normalizePublicPhotoCode(rawPhotoCode)
  if (!photoCode) notFound()
  const share = await getPublicPhotoShare(photoCode)
  if (!share) notFound()

  const requestHeaders = await headers()
  const storeURL = storeURLForUserAgent(requestHeaders.get("user-agent") ?? "")
  const { locale, direction, copy } = getPhotoShareCopy(requestHeaders.get("accept-language") ?? "")
  const hasCoordinates = share.latitude !== null && share.longitude !== null
  const gps = hasCoordinates ? `${share.latitude!.toFixed(6)}, ${share.longitude!.toFixed(6)}` : "—"
  const captureTime = displayDateTime(share.captureTime, share.timestamp, locale)
  const compactCaptureTime = captureTime.replace(/^(\d{4}-\d{1,2}-\d{1,2})[ T](\d{1,2}:\d{2}(?::\d{2})?)/, "$1\n$2")
  const membership = (value: string) => value || copy.none

  return <div className={styles.page} lang={locale} dir={direction}>
    <header className={styles.header}>
      <div className={styles.brand}><img src="/logo.png" alt="Timeprint" /><span>Timeprint</span></div>
      <a className={styles.getApp} href={storeURL}>{copy.openApp}</a>
    </header>
    <main className={styles.main}>
      <section className={styles.hero}>
        <img className={styles.photo} src={share.imageUrl} alt={copy.uploadedPhoto} />
        <div className={styles.photoCaption}>
          <div><div className={styles.eyebrow}>{copy.uploadedPhoto}</div><strong className={styles.code}>{share.photoCode}</strong></div>
          <div className={`${styles.status} ${share.verified ? "" : styles.statusWarning}`}>
            <span className={styles.statusIcon}><span>{share.verified ? "✓" : "!"}</span></span>
            {share.verified ? copy.verified : copy.inconsistent}
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.detailsHeader}>
          <h2>{copy.verificationDetails}</h2>
          <span className={`${styles.summaryBadge} ${share.verified ? "" : styles.mismatchBadge}`}>
            {share.verified ? <Check size={16} strokeWidth={3} /> : "!"}
            {share.verified ? copy.allVerified : copy.partiallyVerified}
          </span>
        </div>
        <div className={styles.detailRows}>
          <DetailRow icon={<Clock3 />} label={copy.captureTime} value={captureTime} verified={share.timeVerified} match={copy.match} mismatch={copy.mismatch} />
          <DetailRow icon={<MapPin />} label={copy.captureLocation} value={share.address || "—"} verified={share.addressVerified} match={copy.match} mismatch={copy.mismatch} />
          <DetailRow icon={<Crosshair />} label={copy.gpsDetail} value={gps} />
          <DetailRow icon={<ImageIcon />} label={copy.photoContent} value={share.contentVerified ? copy.match : copy.mismatch} verified={share.contentVerified} match={copy.match} mismatch={copy.mismatch} />
          <DetailRow icon={<Hash />} label={copy.photoCode} value={share.photoCode} verified={share.photoCodeVerified} match={copy.match} mismatch={copy.mismatch} code />
          <DetailRow icon={<Folder />} label={copy.project} value={membership(share.projectName)} />
          <DetailRow icon={<Users />} label={copy.team} value={membership(share.groupName)} />
          <DetailRow icon={<Smartphone />} label={copy.deviceModel} value={share.deviceModel || "—"} />
          <DetailRow icon={<Smartphone />} label={copy.systemVersion} value={share.os || share.versionCode || "—"} />
          <DetailRow icon={<Camera />} label={copy.captureSource} value="Timeprint" />
          {share.locationAccuracyMeters !== null && <DetailRow icon={<Navigation />} label={copy.accuracy} value={`±${Math.round(share.locationAccuracyMeters)} m`} />}
          <DetailRow icon={<Globe2 />} label={copy.timezone} value={share.timezone || "—"} />
          <DetailRow icon={<ShieldCheck />} label={copy.conclusion} value={share.verified ? copy.workReference : copy.reviewRequired} conclusion={share.verified} match={copy.match} mismatch={copy.mismatch} />
        </div>
      </section>

      <section className={`${styles.card} ${styles.captureRecordCard}`}>
        <h2 className={styles.captureRecordTitle}>{copy.captureRecord}</h2>
        <div className={styles.captureRecordGrid}>
          <CaptureRecordItem icon={<Clock3 />} label={copy.captureTime} value={compactCaptureTime} />
          <CaptureRecordItem icon={<MapPin />} label={copy.captureLocation} value={share.address || "—"} />
          <CaptureRecordItem icon={<Smartphone />} label={copy.deviceSource} value={share.deviceModel || "Timeprint"} />
          <CaptureRecordItem icon={<Hash />} label={copy.photoCode} value={share.photoCode} code />
        </div>
      </section>

      <p className={styles.compressedTip}>ⓘ {copy.compressedTip}</p>

      <section className={`${styles.card} ${styles.verifyCard}`}>
        <div className={styles.verifyMark}>✓</div>
        <h2>{copy.verifyTitle}</h2>
        <p>{copy.verifyBody}</p>
        <a className={styles.verifyButton} href={storeURL}>{copy.openApp}</a>
      </section>

      <section className={styles.downloads} id="download">
        <h2>Timeprint · {copy.downloadTitle}</h2>
        <p>{copy.downloadBody}</p>
        <div className={styles.downloadButtons}>
          <a className={styles.downloadItem} href={APP_STORE_URL}>
            <img src="/appstore.png" alt={`${copy.openApp} · App Store`} />
            <span>App Store</span>
          </a>
          <a className={styles.downloadItem} href={GOOGLE_PLAY_URL}>
            <img src="/googleplay.png" alt={`${copy.openApp} · Google Play`} />
            <span>Google Play</span>
          </a>
        </div>
        <div className={styles.privacy}>{copy.privacy}</div>
      </section>
    </main>
  </div>
}

function DetailRow({ icon, label, value, verified, match, mismatch, code = false, conclusion }: {
  icon: ReactNode
  label: string
  value: string
  verified?: boolean
  match?: string
  mismatch?: string
  code?: boolean
  conclusion?: boolean
}) {
  return <div className={styles.detailRow}>
    <span className={styles.detailIcon}>{icon}</span>
    <span className={styles.detailLabel}>{label}</span>
    <span className={`${styles.detailValue} ${code ? styles.code : ""}`}>{value}</span>
    {typeof verified === "boolean" && typeof conclusion !== "boolean" && <span className={`${styles.matchBadge} ${verified ? "" : styles.mismatchBadge}`}>{verified ? match : mismatch}</span>}
    {typeof conclusion === "boolean" && (conclusion
      ? <CheckCircle2 className={styles.conclusionCheck} aria-label={match} />
      : <span className={`${styles.conclusionCheck} ${styles.conclusionMismatch}`} aria-label={mismatch}>!</span>)}
  </div>
}

function CaptureRecordItem({ icon, label, value, code = false }: { icon: ReactNode; label: string; value: string; code?: boolean }) {
  return <div className={styles.captureRecordItem}>
    <span className={styles.captureRecordIcon}>{icon}</span>
    <strong>{label}</strong>
    <span className={`${styles.captureRecordValue} ${code ? styles.code : ""}`}>{value}</span>
  </div>
}
