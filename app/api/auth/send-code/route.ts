import { NextResponse } from "next/server"
import { getOrCreateVerificationCode } from "@/lib/auth"
import { localeFromRequest, t } from "@/lib/i18n"
import { sendVerificationEmail } from "@/lib/mail"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email } = body
    const locale = localeFromRequest(req, body)

    if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: t(locale, "common.invalidEmail") }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const { code, expiresAt, reused } = await getOrCreateVerificationCode(normalizedEmail)

    await sendVerificationEmail(normalizedEmail, code, locale)

    return NextResponse.json({ success: true, message: t(locale, "common.sentCode"), expiresAt, reused })
  } catch (err) {
    console.log("[v0] send-code error:", err)
    return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
  }
}
