"use client"

import { useRef, useState, useEffect } from "react"
import QRCode from "qrcode"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { ArrowLeft, Loader2, Mail, QrCode, RefreshCw } from "lucide-react"
import { clientLocale, localeDateCode, LOCALE_CHANGE_EVENT, resolveLocale, t } from "@/lib/i18n"

type Step = "email" | "code" | "qrCode"

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string
            callback: (response: { credential?: string }) => void
            ux_mode?: "popup" | "redirect"
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black"
              size?: "large" | "medium" | "small"
              type?: "standard" | "icon"
              shape?: "rectangular" | "pill" | "circle" | "square"
              text?: "signin_with" | "signup_with" | "continue_with" | "signin"
              width?: number
              locale?: string
            },
          ) => void
        }
      }
    }
  }
}

interface LoginCardProps {
  onSuccess: (data: { token: string; expiresAt: string; user: { id: string; email: string } }) => void
  className?: string
}

function qrLoginText(locale: string, key: "button" | "title" | "desc" | "confirmed" | "expired" | "refresh") {
  const zh = resolveLocale(locale).startsWith("zh")
  const copy = zh
    ? {
        button: "使用 App 扫码登录",
        title: "扫码登录",
        desc: "请使用已登录的 Timeprint App 扫描二维码",
        confirmed: "已确认，正在登录",
        expired: "二维码已过期",
        refresh: "刷新二维码",
      }
    : {
        button: "Scan with the App",
        title: "Scan to log in",
        desc: "Scan this QR code with the signed-in Timeprint App",
        confirmed: "Confirmed, logging in",
        expired: "QR code expired",
        refresh: "Refresh QR code",
      }
  return copy[key]
}

export function LoginCard({ onSuccess, className = "" }: LoginCardProps) {
  const [locale, setLocale] = useState("zh-Hans")
  const [step, setStep] = useState<Step>("qrCode")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [qrLogin, setQrLogin] = useState<{ scanToken: string; browserSecret: string; scanURL: string; expiresAt: string } | null>(null)
  const [qrImage, setQrImage] = useState("")
  const [qrRefreshKey, setQrRefreshKey] = useState(0)
  const [qrConfirmed, setQrConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleClientID, setGoogleClientID] = useState("")
  const [googleScriptReady, setGoogleScriptReady] = useState(false)
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(0)
  const googleButtonRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    fetch("/api/auth/google-client")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.clientID === "string") setGoogleClientID(data.clientID)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (window.google?.accounts?.id) {
      setGoogleScriptReady(true)
      return
    }
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
    if (existing) {
      existing.addEventListener("load", () => setGoogleScriptReady(true), { once: true })
      return
    }
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = () => setGoogleScriptReady(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!googleClientID || !googleScriptReady || !googleButtonRef.current || !window.google?.accounts?.id) return
    googleButtonRef.current.innerHTML = ""
    window.google.accounts.id.initialize({
      client_id: googleClientID,
      callback: handleGoogleCredential,
      ux_mode: "popup",
    })
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      type: "standard",
      shape: "rectangular",
      text: "signin_with",
      width: googleButtonRef.current.clientWidth || 320,
      locale: localeDateCode(resolveLocale(locale)),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientID, googleScriptReady, locale])

  useEffect(() => {
    if (step !== "qrCode") return
    let cancelled = false
    setError("")
    setQrLogin(null)
    setQrImage("")
    setQrConfirmed(false)
    fetch("/api/auth/qr-login/create", { method: "POST" })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || t(locale, "common.networkError"))
        const image = await QRCode.toDataURL(data.scanURL, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0f172a", light: "#ffffff" },
        })
        if (!cancelled) {
          setQrLogin(data)
          setQrImage(image)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t(locale, "common.networkError"))
      })
    return () => { cancelled = true }
  }, [step, qrRefreshKey, locale])

  useEffect(() => {
    if (step !== "qrCode" || !qrLogin) return
    let cancelled = false
    let requesting = false
    async function poll() {
      if (requesting || cancelled) return
      requesting = true
      try {
        const res = await fetch("/api/auth/qr-login/status", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-locale": locale },
          body: JSON.stringify({ scanToken: qrLogin?.scanToken, browserSecret: qrLogin?.browserSecret, locale }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || t(locale, "common.verifyFailed"))
        if (data.status === "authenticated") {
          setQrConfirmed(true)
          onSuccess({
            token: data.token,
            expiresAt: data.expiresAt,
            user: data.user || { id: data.userID, email: data.email || "" },
          })
        } else if (data.status === "expired" || data.status === "consumed") {
          setError(qrLoginText(locale, "expired"))
        } else if (data.status === "confirmed") {
          setQrConfirmed(true)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t(locale, "common.networkError"))
      } finally {
        requesting = false
      }
    }
    poll()
    const timer = window.setInterval(poll, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [step, qrLogin, locale, onSuccess])

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

  async function handleGoogleCredential(response: { credential?: string }) {
    const identityToken = response.credential
    if (!identityToken) {
      setError(t(locale, "login.googleFailed"))
      return
    }
    setError("")
    setGoogleLoading(true)
    try {
      const res = await fetch("/api/user/login/google", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-locale": locale },
        body: JSON.stringify({ identityToken, locale }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || t(locale, "login.googleFailed"))
        return
      }
      onSuccess({
        token: data.token,
        expiresAt: data.expiresAt,
        user: data.user || { id: data.userID, email: data.email },
      })
    } catch {
      setError(t(locale, "common.networkError"))
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <Card className={`w-full max-w-sm border-orange-100 bg-white/90 text-slate-950 shadow-2xl shadow-orange-900/10 backdrop-blur-xl ring-orange-50 ${className}`}>
      <CardHeader className="space-y-2">
        <CardTitle className="text-3xl font-semibold text-slate-950">
          {step === "email" ? t(locale, "login.freeStart") : step === "qrCode" ? qrLoginText(locale, "title") : t(locale, "login.titleCode")}
        </CardTitle>
        {step === "code" && <CardDescription className="text-slate-500">{t(locale, "login.descCode", { email })}</CardDescription>}
        {step === "qrCode" && <CardDescription className="text-slate-500">{qrLoginText(locale, "desc")}</CardDescription>}
      </CardHeader>

      <CardContent className="space-y-4">
        {step === "email" && (
          <div className="space-y-4">
            <div className="relative min-h-11">
              <div ref={googleButtonRef} className="w-full [&>div]:mx-auto" />
              {(!googleClientID || !googleScriptReady || googleLoading) && (
                <div className="absolute inset-0 flex h-11 items-center justify-center rounded-lg border bg-white text-sm font-medium text-slate-600">
                  {googleLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {t(locale, "login.googleLoading")}
                    </>
                  ) : (
                    t(locale, googleClientID ? "common.loading" : "login.googleUnavailable")
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-slate-500">
              <div className="h-px flex-1 bg-slate-200" />
              <span>{t(locale, "login.or")}</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="h-11 border-slate-200 bg-white px-3 text-slate-950 placeholder:text-slate-400 focus-visible:border-orange-400 focus-visible:ring-orange-200/60"
                />
              </div>
              {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</p>}
              <Button type="submit" className="h-11 w-full bg-[#ea580c] text-white shadow-lg shadow-orange-200/70 hover:bg-[#f97316]" disabled={loading || !email}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? t(locale, "login.sendingEmailCode") : t(locale, "login.emailLogin")}
              </Button>
            </form>

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full border-orange-200 bg-white text-[#ea580c] hover:bg-orange-50 hover:text-[#c2410c]"
              onClick={() => {
                setStep("qrCode")
                setError("")
              }}
            >
              <QrCode className="size-4" /> {qrLoginText(locale, "button")}
            </Button>
          </div>
        )}

        {step === "qrCode" && (
          <div className="space-y-4">
            <div className="mx-auto flex aspect-square w-[240px] items-center justify-center overflow-hidden rounded-lg border border-orange-100 bg-white p-2">
              {qrImage ? (
                <img src={qrImage} alt={qrLoginText(locale, "title")} className="size-full" />
              ) : (
                <Loader2 className="size-7 animate-spin text-[#ea580c]" />
              )}
            </div>
            {qrConfirmed && (
              <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" /> {qrLoginText(locale, "confirmed")}
              </p>
            )}
            {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</p>}
            <Button type="button" variant="outline" className="h-10 w-full border-orange-200 text-[#ea580c] hover:bg-orange-50" onClick={() => setQrRefreshKey((value) => value + 1)}>
              <RefreshCw className="size-4" /> {qrLoginText(locale, "refresh")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep("email")
                setQrLogin(null)
                setQrImage("")
                setError("")
              }}
              className="h-11 w-full border-orange-200 bg-white text-[#ea580c] hover:bg-orange-50 hover:text-[#c2410c]"
            >
              <Mail className="size-4" /> {t(locale, "login.emailLogin")}
            </Button>
          </div>
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
