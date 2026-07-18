"use client"

import { useState, useEffect } from "react"
import { LoginCard } from "@/components/login-card"
import { Dashboard } from "@/components/dashboard"
import { LanguageSwitcher } from "@/components/language-switcher"
import { clientLocale, t, type AppLocale } from "@/lib/i18n"
import { Apple, Camera, Clock3, Download, MapPinned, Play, ShieldCheck, Users } from "lucide-react"

interface Auth {
  token: string
  expiresAt: string
  user: { id: string; email: string }
}

const STORAGE_KEY = "auth"

export default function Page() {
  const [auth, setAuth] = useState<Auth | null>(null)
  const [ready, setReady] = useState(false)
  const [locale, setLocale] = useState<AppLocale>("zh-Hans")

  // Restore the local login session.
  useEffect(() => {
    try {
      setLocale(clientLocale())
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setAuth(JSON.parse(raw))
    } catch {}
    setReady(true)
  }, [])

  function handleSuccess(data: Auth) {
    setAuth(data)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  function handleLogout() {
    setAuth(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  if (!ready) return <main className="min-h-svh bg-background" />

  if (auth) {
    return (
      <main className="min-h-svh bg-background p-0">
        <Dashboard
          token={auth.token}
          user={auth.user}
          expiresAt={auth.expiresAt}
          onLogout={handleLogout}
        />
      </main>
    )
  }

  const featureItems = [
    { icon: ShieldCheck, title: t(locale, "home.feature.authentic.title"), desc: t(locale, "home.feature.authentic.desc") },
    { icon: MapPinned, title: t(locale, "home.feature.gps.title"), desc: t(locale, "home.feature.gps.desc") },
    { icon: Users, title: t(locale, "home.feature.team.title"), desc: t(locale, "home.feature.team.desc") },
  ]

  return (
    <main className="relative min-h-svh overflow-hidden bg-[linear-gradient(145deg,#fff7ed_0%,#ffedd5_42%,#fffaf5_72%,#ffffff_100%)] text-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-orange-200/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white/85 to-transparent" />
      </div>

      <LanguageSwitcher
        locale={locale}
        onLocaleChange={setLocale}
        className="fixed right-4 top-4 z-50 text-slate-950"
      />

      <section className="relative mx-auto grid min-h-svh w-full max-w-7xl items-center gap-10 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-white/70 px-3 py-1.5 text-sm text-orange-700 shadow-sm backdrop-blur">
            <Camera className="size-4" />
            {t(locale, "home.eyebrow")}
          </div>

          <div className="max-w-2xl space-y-5">
            <h1 className="text-4xl font-semibold leading-tight tracking-normal text-[#ea580c] md:text-6xl">
              {t(locale, "home.title")}
            </h1>
            <p className="max-w-xl text-lg leading-8 text-slate-700/90">
              {t(locale, "home.subtitle")}
            </p>
          </div>

          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {featureItems.map((item) => (
              <div key={item.title} className="rounded-lg border border-orange-100 bg-white/75 p-4 shadow-[0_12px_30px_rgba(154,52,18,0.06)] backdrop-blur">
                <item.icon className="mb-3 size-5 text-[#f97316]" />
                <h2 className="text-sm font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="relative hidden h-[300px] max-w-2xl items-center justify-center md:flex">
            <div className="absolute h-36 w-[32rem] rounded-[50%] border border-orange-200/80" />
            <div className="absolute h-52 w-[24rem] rounded-[50%] border border-orange-100" />
            <div className="absolute left-3 top-24 flex size-24 flex-col items-center justify-center rounded-full bg-white/78 text-slate-700 ring-1 ring-orange-100 shadow-sm backdrop-blur">
              <MapPinned className="size-7 text-[#f97316]" />
              <span className="mt-2 text-xs">{t(locale, "home.orbit.location")}</span>
            </div>
            <div className="absolute right-8 top-20 flex size-24 flex-col items-center justify-center rounded-full bg-white/78 text-slate-700 ring-1 ring-orange-100 shadow-sm backdrop-blur">
              <Clock3 className="size-7 text-[#f97316]" />
              <span className="mt-2 text-xs">{t(locale, "home.orbit.time")}</span>
            </div>
            <div className="absolute bottom-4 left-1/2 flex size-24 -translate-x-1/2 flex-col items-center justify-center rounded-full bg-white/78 text-slate-700 ring-1 ring-orange-100 shadow-sm backdrop-blur">
              <Users className="size-7 text-[#f97316]" />
              <span className="mt-2 text-xs">{t(locale, "home.orbit.team")}</span>
            </div>
            <div className="relative flex size-44 flex-col items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-orange-500 to-orange-700 text-white shadow-2xl shadow-orange-300/35">
              <img src="/logo.png" alt="Timeprint" className="size-14 rounded-2xl" />
              <span className="mt-4 text-sm font-semibold">{t(locale, "home.product")}</span>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col items-center justify-start gap-6 pt-12 lg:items-end lg:pt-32">
          <LoginCard onSuccess={handleSuccess} className="max-w-[22rem]" />
        </div>
      </section>

      <section id="download" className="relative overflow-hidden bg-[#ffea00]/10 px-5 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-normal text-slate-950 md:text-4xl">{t(locale, "download.title")}</h2>
          <p className="mx-auto mb-12 max-w-2xl text-slate-600">{t(locale, "download.subtitle")}</p>

          <div className="mb-12 flex flex-col items-center justify-center gap-6 md:flex-row">
            <a
              href="https://apps.apple.com/us/app/timeprint-timestamp-gps-camera/id6480020509"
              className="flex items-center gap-2 rounded-lg bg-[#ffea00] px-6 py-3 text-black shadow-md transition-colors hover:bg-yellow-300"
            >
              <Apple className="size-6" />
              <span className="font-medium">{t(locale, "download.appStore")}</span>
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.timestampcamerafree.gpsmapcameratimemark.geotagginglocationonphoto"
              className="flex items-center gap-2 rounded-lg bg-[#ffea00] px-6 py-3 text-black shadow-md transition-colors hover:bg-yellow-300"
            >
              <Play className="size-6" />
              <span className="font-medium">{t(locale, "download.googlePlay")}</span>
            </a>
            <a
              href="http://dl.aiboot.cloud/Timeprint-core-release.apk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-[#ffea00] px-6 py-3 text-black shadow-md transition-colors hover:bg-yellow-300"
            >
              <Download className="size-6" />
              <span className="font-medium">{t(locale, "download.downloadApk")}</span>
            </a>
          </div>

          <div className="flex flex-col items-center">
            <p className="mb-4 text-slate-600">{t(locale, "download.scanQR")}</p>
            <div className="flex flex-col items-center justify-center gap-8 md:flex-row">
              <div className="flex flex-col items-center">
                <h3 className="mb-2 text-lg font-semibold">App Store</h3>
                <div className="size-40 rounded-lg border-2 border-[#ffea00] bg-white p-2 shadow-md">
                  <img src="/appstore.png" alt="App Store QR Code" className="size-full" />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <h3 className="mb-2 text-lg font-semibold">Google Play</h3>
                <div className="size-40 rounded-lg border-2 border-[#ffea00] bg-white p-2 shadow-md">
                  <img src="/googleplay.png" alt="Google Play QR Code" className="size-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative h-32 w-full">
          <div className="absolute bottom-0 left-1/4 size-32 rounded-full bg-[#ffea00]/30 blur-2xl" />
          <div className="absolute bottom-0 right-1/4 size-32 rounded-full bg-[#ffea00]/30 blur-2xl" />
        </div>
      </section>
    </main>
  )
}
