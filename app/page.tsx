"use client"

import { useState, useEffect } from "react"
import { LoginCard } from "@/components/login-card"
import { Dashboard } from "@/components/dashboard"
import { LanguageSwitcher } from "@/components/language-switcher"
import { clientLocale, t, type AppLocale } from "@/lib/i18n"
import { Camera, Clock3, MapPinned, ShieldCheck, Users } from "lucide-react"

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
    <main className="relative min-h-svh overflow-hidden bg-[#111769] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 -top-32 size-96 rounded-full bg-[#2435d4]/40 blur-3xl" />
        <div className="absolute -right-40 -top-36 size-[34rem] rounded-full bg-[#2631a4]/35 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-1/2 w-full bg-[radial-gradient(circle_at_35%_100%,rgba(0,210,255,0.18),transparent_36%),linear-gradient(180deg,transparent,rgba(3,8,58,0.8))]" />
      </div>

      <LanguageSwitcher
        locale={locale}
        onLocaleChange={setLocale}
        className="fixed right-4 top-4 z-50 text-slate-950"
      />

      <section className="relative mx-auto grid min-h-svh w-full max-w-7xl items-center gap-10 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-white/10 px-3 py-1.5 text-sm text-cyan-100 backdrop-blur">
            <Camera className="size-4" />
            {t(locale, "home.eyebrow")}
          </div>

          <div className="max-w-2xl space-y-5">
            <h1 className="text-4xl font-semibold leading-tight tracking-normal text-cyan-300 md:text-6xl">
              {t(locale, "home.title")}
            </h1>
            <p className="max-w-xl text-lg leading-8 text-blue-50/85">
              {t(locale, "home.subtitle")}
            </p>
          </div>

          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {featureItems.map((item) => (
              <div key={item.title} className="rounded-lg border border-white/12 bg-white/8 p-4 backdrop-blur">
                <item.icon className="mb-3 size-5 text-cyan-300" />
                <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                <p className="mt-1 text-xs leading-5 text-blue-50/70">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="relative hidden h-[300px] max-w-2xl items-center justify-center md:flex">
            <div className="absolute h-36 w-[32rem] rounded-[50%] border border-cyan-300/30" />
            <div className="absolute h-52 w-[24rem] rounded-[50%] border border-blue-300/20" />
            <div className="absolute left-3 top-24 flex size-24 flex-col items-center justify-center rounded-full bg-cyan-400/20 ring-1 ring-cyan-200/30 backdrop-blur">
              <MapPinned className="size-7 text-cyan-200" />
              <span className="mt-2 text-xs">{t(locale, "home.orbit.location")}</span>
            </div>
            <div className="absolute right-8 top-20 flex size-24 flex-col items-center justify-center rounded-full bg-cyan-400/20 ring-1 ring-cyan-200/30 backdrop-blur">
              <Clock3 className="size-7 text-cyan-200" />
              <span className="mt-2 text-xs">{t(locale, "home.orbit.time")}</span>
            </div>
            <div className="absolute bottom-4 left-1/2 flex size-24 -translate-x-1/2 flex-col items-center justify-center rounded-full bg-cyan-400/20 ring-1 ring-cyan-200/30 backdrop-blur">
              <Users className="size-7 text-cyan-200" />
              <span className="mt-2 text-xs">{t(locale, "home.orbit.team")}</span>
            </div>
            <div className="relative flex size-44 flex-col items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-700 shadow-2xl shadow-cyan-950/60">
              <img src="/logo.png" alt="Timeprint" className="size-14 rounded-2xl" />
              <span className="mt-4 text-sm font-semibold">{t(locale, "home.product")}</span>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col items-center justify-start gap-6 pt-12 lg:items-end lg:pt-32">
          <LoginCard onSuccess={handleSuccess} className="max-w-[22rem]" />
        </div>
      </section>
    </main>
  )
}
