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
import { clientLocale, t } from "@/lib/i18n"

type Step = "email" | "code"

interface LoginCardProps {
  onSuccess: (data: { token: string; expiresAt: string; user: { id: string; email: string } }) => void
}

export function LoginCard({ onSuccess }: LoginCardProps) {
  const [locale, setLocale] = useState("zh-Hans")
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    setLocale(clientLocale())
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
        body: JSON.stringify({ email, code: submitCode }),
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
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-2">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Mail className="size-5" />
        </div>
        <CardTitle className="text-xl">
          {step === "email" ? t(locale, "login.titleEmail") : t(locale, "login.titleCode")}
        </CardTitle>
        <CardDescription>
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
              <Label htmlFor="email">{t(locale, "login.emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !email}>
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
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {loading && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
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
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" /> {t(locale, "web.back")}
              </button>
              <button
                type="button"
                onClick={sendCode}
                disabled={countdown > 0 || loading}
                className="text-primary disabled:text-muted-foreground disabled:cursor-not-allowed"
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
