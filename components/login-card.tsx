"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Mail, ArrowLeft, Loader2 } from "lucide-react"
import { clientLocale, LOCALE_CHANGE_EVENT, resolveLocale, t } from "@/lib/i18n"

type Step = "email" | "code"

interface LoginCardProps {
  onSuccess: (data: { token: string; expiresAt: string; user: { id: string; email: string } }) => void
  className?: string
}

export function LoginCard({ onSuccess, className = "" }: LoginCardProps) {
  const [locale, setLocale] = useState("zh-Hans")
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    setLocale(clientLocale())
    function handleLocaleChange(event: Event) {
      setLocale(resolveLocale((event as CustomEvent).detail))
    }
    window.addEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange)
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange)
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  async function sendCode() {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || t(locale, "common.sendFailed"))
        return
      }
      setStep("code")
      setCountdown(60)
    } catch {
      setError(t(locale, "common.networkError"))
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(submitCode: string) {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: submitCode, locale }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || t(locale, "common.verifyFailed"))
        setCode("")
        return
      }
      onSuccess(data)
    } catch {
      setError(t(locale, "common.networkError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={`w-full max-w-sm border-orange-100 bg-white/90 text-slate-950 shadow-2xl shadow-orange-900/10 backdrop-blur-xl ring-orange-50 ${className}`}>
      <CardHeader className="space-y-2">
        <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#ea580c] ring-1 ring-orange-100">
            <Mail className="size-5" />
          </div>
          <CardTitle className="text-center text-xl text-slate-950">
            {step === "email" ? t(locale, "login.titleEmail") : t(locale, "login.titleCode")}
          </CardTitle>
          <div aria-hidden="true" />
        </div>
        <CardDescription className="text-slate-500">
          {step === "email"
            ? t(locale, "login.descEmail")
            : t(locale, "login.descCode", { email })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {step === "email" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendCode()
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">{t(locale, "login.emailLabel")}：</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-11 border-orange-100 bg-[#fff7ed]/70 px-3 text-slate-950 placeholder:text-slate-400 focus-visible:border-orange-400 focus-visible:ring-orange-200/60"
              />
            </div>
            {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</p>}
            <Button type="submit" className="h-11 w-full bg-[#ea580c] text-white shadow-lg shadow-orange-200/70 hover:bg-[#f97316]" disabled={loading || !email}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t(locale, "login.sendCode")}
            </Button>
          </form>
        )}

        {step === "code" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v)
                  if (v.length === 6) verifyCode(v)
                }}
                disabled={loading}
              >
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot index={0} className="rounded-lg border border-orange-100 bg-[#fff7ed]/70 text-slate-950 data-[active=true]:border-orange-400 data-[active=true]:ring-orange-200/60" />
                  <InputOTPSlot index={1} className="rounded-lg border border-orange-100 bg-[#fff7ed]/70 text-slate-950 data-[active=true]:border-orange-400 data-[active=true]:ring-orange-200/60" />
                  <InputOTPSlot index={2} className="rounded-lg border border-orange-100 bg-[#fff7ed]/70 text-slate-950 data-[active=true]:border-orange-400 data-[active=true]:ring-orange-200/60" />
                  <InputOTPSlot index={3} className="rounded-lg border border-orange-100 bg-[#fff7ed]/70 text-slate-950 data-[active=true]:border-orange-400 data-[active=true]:ring-orange-200/60" />
                  <InputOTPSlot index={4} className="rounded-lg border border-orange-100 bg-[#fff7ed]/70 text-slate-950 data-[active=true]:border-orange-400 data-[active=true]:ring-orange-200/60" />
                  <InputOTPSlot index={5} className="rounded-lg border border-orange-100 bg-[#fff7ed]/70 text-slate-950 data-[active=true]:border-orange-400 data-[active=true]:ring-orange-200/60" />
                </InputOTPGroup>
              </InputOTP>
              {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</p>}
              {loading && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="size-4 animate-spin" /> {t(locale, "login.verifying")}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("email")
                  setCode("")
                  setError("")
                }}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-950"
              >
                <ArrowLeft className="size-4" /> {t(locale, "web.back")}
              </button>
              <button
                type="button"
                onClick={sendCode}
                disabled={countdown > 0 || loading}
                className="text-[#ea580c] disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {countdown > 0 ? t(locale, "login.resendAfter", { seconds: countdown }) : t(locale, "login.resend")}
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
