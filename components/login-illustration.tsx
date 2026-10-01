import { Folder, Images, LayoutGrid, Users } from "lucide-react"
import { t } from "@/lib/i18n"
import styles from "@/app/login.module.css"

const assetBase = "https://wm-1330977225.cos.ap-singapore.myqcloud.com/timeprint-teamspace-login-20261001"
const photos = ["construction-trench", "security-patrol", "facility-cleaning", "rebar-crew", "warehouse-pallet", "loading-dock"]

// iOS bundled sample photos and an unretouched simulator capture using demo data.
// This is decorative product artwork, not an interactive second workspace.
export function LoginIllustration({ locale }: { locale: string }) {
  const language = locale.toLowerCase().split(/[-_]/)[0]
  const screenshotLocale = ["vi", "th", "id"].includes(language) ? language : "en"
  return (
    <div className={styles.productVisual} aria-hidden="true">
      <div className={styles.desktopPreview}>
        <div className={styles.previewBar}>
          <span className={styles.windowDots}><i /><i /><i /></span>
          <span>Timeprint</span>
          <LayoutGrid size={12} />
        </div>
        <div className={styles.previewBody}>
          <div className={styles.previewSidebar}>
            <span><Images size={16} /></span>
            <Folder size={16} />
            <Users size={16} />
          </div>
          <div className={styles.previewLibrary}>
            <div className={styles.previewHeading}>{t(locale, "dashboard.photos")}<LayoutGrid size={13} /></div>
            <div className={styles.previewPhotos}>
              {photos.map((name) => (
                <img key={name} src={`${assetBase}/${name}.jpg`} alt="" width={600} height={800} loading="lazy" decoding="async" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className={styles.phonePreview}>
        <img src={`${assetBase}/ios-team-home-${screenshotLocale}.webp`} alt="" width={1206} height={2622} loading="lazy" decoding="async" />
      </div>
    </div>
  )
}
