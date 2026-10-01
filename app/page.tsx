"use client"

import { useState, useEffect } from "react"
import { LoginCard } from "@/components/login-card"
import { Workspace } from "@/components/workspace/workspace"
import { LanguageSwitcher } from "@/components/language-switcher"
import { clientLocale, t, type AppLocale } from "@/lib/i18n"
import {
  AUTH_STORAGE_KEY,
  clearStoredAuth,
  resetExpiredSessionHandling,
  SESSION_EXPIRED_EVENT,
} from "@/lib/client-auth"
import { Apple, Download, Play } from "lucide-react"
import { LoginIllustration } from "@/components/login-illustration"
import styles from "./login.module.css"

interface Auth {
  token: string
  expiresAt: string
  user: { id: string; email: string; userName?: string | null; shortName?: string | null }
}

export default function Page() {
  const [auth, setAuth] = useState<Auth | null>(null)
  const [ready, setReady] = useState(false)
  const [locale, setLocale] = useState<AppLocale>("zh-Hans")

  // Restore the local login session.
  useEffect(() => {
    try {
      setLocale(clientLocale())
      const raw = localStorage.getItem(AUTH_STORAGE_KEY)
      if (raw) {
        const stored = JSON.parse(raw) as Auth
        // 旧 expiresAt 不再代表失效；由服务端判断 token 是否已被撤销。
        if (stored.token) setAuth(stored)
      }
    } catch {}
    setReady(true)
  }, [])

  useEffect(() => {
    function handleSessionExpired() {
      setAuth(null)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [])

  function handleSuccess(data: Auth) {
    resetExpiredSessionHandling()
    setAuth(data)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data))
  }

  function handleLogout() {
    setAuth(null)
    clearStoredAuth()
  }

  if (!ready) return <main className="min-h-svh bg-background" />

  if (auth) {
    return (
      <main className="min-h-svh bg-background p-0">
        <Workspace
          token={auth.token}
          user={auth.user}
          expiresAt={auth.expiresAt}
          onLogout={handleLogout}
        />
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.brand} aria-label="Timeprint">
          <img src="/logo.png" alt="" width={36} height={36} />
          <span>Timeprint</span>
        </a>
        <LanguageSwitcher locale={locale} onLocaleChange={setLocale} />
      </header>

      <section className={styles.main}>
        <div className={styles.story}>
          <div className={styles.intro}>
            <h1>{t(locale, "home.feature.team.title")}</h1>
            <p>{t(locale, "home.feature.team.desc")}</p>
          </div>
          <LoginIllustration />
          <div className={styles.caption}>
            <span>{t(locale, "home.feature.gps.title")}</span>
            <p>{t(locale, "home.feature.gps.desc")}</p>
          </div>
        </div>

        <div className={styles.signIn}>
          <LoginCard onSuccess={handleSuccess} />
          <a href="#download" className={styles.downloadLink}>
            <Download size={16} aria-hidden="true" />
            {t(locale, "download.title")}
          </a>
        </div>
      </section>

      <section id="download" className={styles.download}>
        <div className={styles.downloadIntro}>
          <h2>{t(locale, "download.title")}</h2>
          <p>{t(locale, "download.subtitle")}</p>
          <a href="http://dl.aiboot.cloud/Timeprint-core-release.apk" target="_blank" rel="noopener noreferrer" className={styles.apk}>
            <Download size={16} aria-hidden="true" /> {t(locale, "download.downloadApk")}
          </a>
        </div>
        <div className={styles.stores}>
          <p>{t(locale, "download.scanQR")}</p>
          <div className={styles.storeOptions}>
            <div className={styles.store}>
              <img src="/appstore.png" alt="App Store QR Code" width={100} height={100} loading="lazy" />
              <a href="https://apps.apple.com/us/app/timeprint-timestamp-gps-camera/id6480020509">
                <Apple size={18} aria-hidden="true" /> {t(locale, "download.appStore")}
              </a>
            </div>
            <div className={styles.store}>
              <img src="/googleplay.png" alt="Google Play QR Code" width={100} height={100} loading="lazy" />
              <a href="https://play.google.com/store/apps/details?id=com.timestampcamerafree.gpsmapcameratimemark.geotagginglocationonphoto">
                <Play size={18} aria-hidden="true" /> {t(locale, "download.googlePlay")}
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
