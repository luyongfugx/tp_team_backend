import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getPublicPhotoShare, normalizePublicPhotoCode } from "@/lib/publicPhotoShare"
import styles from "./page.module.css"

export const dynamic = "force-dynamic"

const APP_STORE_URL = "https://apps.apple.com/us/app/timeprint-timestamp-gps-camera/id6480020509"
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.timestampcamerafree.gpsmapcameratimemark.geotagginglocationonphoto"

type PageProps = { params: Promise<{ photoCode: string }> }

function mapLinks(latitude: number, longitude: number) {
  const deltaLat = 0.006
  const deltaLng = 0.01
  const bbox = [longitude - deltaLng, latitude - deltaLat, longitude + deltaLng, latitude + deltaLat]
    .map((value) => value.toFixed(6))
    .join("%2C")
  const marker = `${latitude.toFixed(6)}%2C${longitude.toFixed(6)}`
  return {
    preview: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`,
    navigation: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  }
}

function displayDateTime(value: string, timestamp: number | null, locale: string) {
  if (value) return value
  if (!timestamp) return "—"
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(timestamp))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { photoCode } = await params
  const share = await getPublicPhotoShare(photoCode)
  if (!share) return { title: "Photo record not found | Timeprint", robots: { index: false, follow: false } }
  const description = [share.captureTime, share.address].filter(Boolean).join(" · ") || "Timeprint verified photo record"
  return {
    title: `${share.photoCode} | Timeprint Photo Verification`,
    description,
    robots: { index: false, follow: false, nocache: true },
    openGraph: {
      type: "website",
      title: share.verified ? "Timeprint verified photo" : "Timeprint photo verification record",
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
  const isChinese = /(^|,)\s*zh(?:-|;|,|$)/i.test(requestHeaders.get("accept-language") ?? "")
  const locale = isChinese ? "zh-CN" : "en-US"
  const copy = isChinese ? {
    uploadedPhoto: "验真照片",
    verified: "验真通过",
    inconsistent: "信息不一致",
    location: "照片拍摄地点",
    navigate: "导航",
    gps: "GPS 坐标",
    positionType: "定位方式",
    accuracy: "位置精度",
    metadata: "已验证元数据",
    photoCode: "照片码",
    captureTime: "拍摄时间",
    timezone: "时区",
    device: "拍摄设备",
    team: "团队",
    project: "项目",
    dimensions: "照片尺寸",
    result: "验真结论",
    resultPassed: "照片信息与 Timeprint 拍摄记录一致",
    resultWarning: "照片的部分信息与 Timeprint 拍摄记录不一致",
    verifyTitle: "用 Timeprint 验证照片",
    verifyBody: "上传带照片码的照片，核对拍摄时间、地点和照片内容。",
    openApp: "获得 Timeprint",
    downloadTitle: "Proof in Every Photo",
    downloadBody: "使用 Timeprint 拍摄可信的时间与位置记录",
    privacy: "此页面仅供持链接者查看，精确位置来自照片拍摄记录。",
  } : {
    uploadedPhoto: "Verification photo",
    verified: "Verified",
    inconsistent: "Information mismatch",
    location: "Photo capture location",
    navigate: "Navigate",
    gps: "GPS coordinates",
    positionType: "Position source",
    accuracy: "Location accuracy",
    metadata: "Verified metadata",
    photoCode: "Photo code",
    captureTime: "Capture time",
    timezone: "Time zone",
    device: "Capture device",
    team: "Team",
    project: "Project",
    dimensions: "Photo size",
    result: "Verification result",
    resultPassed: "The photo matches its Timeprint capture record",
    resultWarning: "Some photo information differs from its Timeprint capture record",
    verifyTitle: "Verify photos with Timeprint",
    verifyBody: "Upload a photo with a photo code to check its capture time, location and content.",
    openApp: "Get Timeprint",
    downloadTitle: "Proof in Every Photo",
    downloadBody: "Create trustworthy time and location records with Timeprint",
    privacy: "Only people with this link can view it. The precise location comes from the capture record.",
  }
  const maps = share.latitude !== null && share.longitude !== null
    ? mapLinks(share.latitude, share.longitude)
    : null
  const gps = maps ? `${share.latitude!.toFixed(6)}, ${share.longitude!.toFixed(6)}` : "—"
  const dimensions = share.imageWidth && share.imageHeight ? `${share.imageWidth} × ${share.imageHeight}` : "—"
  const device = [share.deviceModel, share.os].filter(Boolean).join(" · ") || "Timeprint"

  return <div className={styles.page}>
    <header className={styles.header}>
      <div className={styles.brand}><img src="/logo.png" alt="Timeprint" /><span>Timeprint</span></div>
      <a className={styles.getApp} href="#download">{copy.openApp}</a>
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
        <h1 className={styles.sectionTitle}>{copy.location}</h1>
        {maps && <div className={styles.mapWrap}>
          <iframe src={maps.preview} loading="lazy" title={copy.location} referrerPolicy="no-referrer" />
          <a className={styles.navigate} href={maps.navigation} target="_blank" rel="noreferrer">⌖ {copy.navigate}</a>
        </div>}
        <div className={styles.locationText}>
          <p className={styles.address}>{share.address || "—"}</p>
          <p className={styles.gps}>{copy.gps}: {gps}</p>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>{copy.metadata}</h2>
        <div className={styles.rows}>
          <MetadataRow label={copy.photoCode} value={share.photoCode} code />
          <MetadataRow label={copy.captureTime} value={displayDateTime(share.captureTime, share.timestamp, locale)} />
          <MetadataRow label={copy.timezone} value={share.timezone || "—"} />
          {share.positionType && <MetadataRow label={copy.positionType} value={share.positionType} />}
          {share.locationAccuracyMeters !== null && <MetadataRow label={copy.accuracy} value={`${share.locationAccuracyMeters} m`} />}
          <MetadataRow label={copy.device} value={device} />
          {share.groupName && <MetadataRow label={copy.team} value={share.groupName} />}
          {share.projectName && <MetadataRow label={copy.project} value={share.projectName} />}
          <MetadataRow label={copy.dimensions} value={dimensions} />
          <MetadataRow label={copy.result} value={share.verified ? copy.resultPassed : copy.resultWarning} />
        </div>
      </section>

      <section className={`${styles.card} ${styles.verifyCard}`}>
        <div className={styles.verifyMark}>✓</div>
        <h2>{copy.verifyTitle}</h2>
        <p>{copy.verifyBody}</p>
        <a className={styles.verifyButton} href="#download">{copy.openApp}</a>
      </section>

      <section className={styles.downloads} id="download">
        <h2>Timeprint · {copy.downloadTitle}</h2>
        <p>{copy.downloadBody}</p>
        <div className={styles.downloadButtons}>
          <a href={APP_STORE_URL}><img src="/appstore.png" alt="Download Timeprint on the App Store" /></a>
          <a href={GOOGLE_PLAY_URL}><img src="/googleplay.png" alt="Get Timeprint on Google Play" /></a>
        </div>
        <div className={styles.privacy}>{copy.privacy}</div>
      </section>
    </main>
  </div>
}

function MetadataRow({ label, value, code = false }: { label: string; value: string; code?: boolean }) {
  return <div className={styles.row}>
    <div className={styles.label}>{label}</div>
    <div className={`${styles.value} ${code ? styles.code : ""}`}>{value}</div>
  </div>
}
