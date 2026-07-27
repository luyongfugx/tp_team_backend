"use client"

import { FormEvent, useEffect, useState } from "react"
import { ArrowRight, Mail, ShieldCheck, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LanguageSwitcher } from "@/components/language-switcher"
import { clientLocale, t, type AppLocale } from "@/lib/i18n"

export default function DeleteAccountPage() {
  const [locale, setLocale] = useState<AppLocale>("zh-Hans")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    setLocale(clientLocale())
  }, [])

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")
    setError("")
    try {
      const res = await fetch("/api/account-deletion/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-locale": locale },
        body: JSON.stringify({ email, locale }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || t(locale, "deleteAccount.submitError"))
        return
      }
      setMessage(data.message || t(locale, "deleteAccount.submitSuccess"))
      setEmail("")
    } catch {
      setError(t(locale, "common.networkError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-svh bg-[linear-gradient(145deg,#fff7ed_0%,#ffffff_48%,#f8fafc_100%)] text-slate-950">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-5 py-6 md:px-8">
        <header className="flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3 text-sm font-semibold text-slate-900">
            <img src="/logo.png" alt="Timeprint" className="size-9 rounded-lg" />
            <span>Timeprint</span>
          </a>
          <LanguageSwitcher locale={locale} onLocaleChange={setLocale} />
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-orange-700 shadow-sm">
              <ShieldCheck className="size-4" />
              {t(locale, "deleteAccount.badge")}
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-slate-950 md:text-6xl">
                {t(locale, "deleteAccount.title")}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                {t(locale, "deleteAccount.subtitle")}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <InfoBlock title={t(locale, "deleteAccount.appNameTitle")} body={t(locale, "deleteAccount.appNameBody")} />
              <InfoBlock title={t(locale, "deleteAccount.inAppPathTitle")} body={t(locale, "deleteAccount.inAppPathBody")} />
              <InfoBlock title={t(locale, "deleteAccount.deletedDataTitle")} body={t(locale, "deleteAccount.deletedDataBody")} />
              <InfoBlock title={t(locale, "deleteAccount.retentionTitle")} body={t(locale, "deleteAccount.retentionBody")} />
            </div>

            <p className="text-sm text-slate-600">
              {t(locale, "deleteAccount.contact")}{" "}
              <a href="mailto:support@timeprint.net" className="font-medium text-orange-700 underline-offset-4 hover:underline">
                support@timeprint.net
              </a>
            </p>
          </div>

          <form onSubmit={submitRequest} className="rounded-lg border border-orange-100 bg-white/90 p-5 shadow-xl shadow-orange-200/20 md:p-7">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{t(locale, "deleteAccount.formTitle")}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{t(locale, "deleteAccount.formDesc")}</p>
              </div>
            </div>

            <label className="mb-2 block text-sm font-medium text-slate-900" htmlFor="delete-email">
              {t(locale, "deleteAccount.emailLabel")}
            </label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="delete-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-10 pl-9"
                  required
                />
              </div>
              <Button type="submit" disabled={loading || !email.trim()} className="h-10 px-4">
                {loading ? t(locale, "deleteAccount.submitting") : t(locale, "deleteAccount.submit")}
                <ArrowRight className="size-4" />
              </Button>
            </div>

            {message && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
            {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <p className="mt-5 text-xs leading-5 text-slate-500">{t(locale, "deleteAccount.formFootnote")}</p>
          </form>
        </section>
      </div>
    </main>
  )
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/75 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  )
}
