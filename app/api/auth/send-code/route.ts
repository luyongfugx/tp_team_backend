import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateCode, CODE_TTL_MS } from "@/lib/auth"
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

    // 限流：60 秒内不可重复发送
    const recent = await prisma.verificationCode.findFirst({
      where: {
        email: normalizedEmail,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    })
    if (recent) {
      return NextResponse.json({ error: t(locale, "common.tooFrequent") }, { status: 429 })
    }

    const code = generateCode()
    const expiresAt = new Date(Date.now() + CODE_TTL_MS)

    // 使该邮箱之前未使用的验证码失效
    await prisma.verificationCode.updateMany({
      where: { email: normalizedEmail, consumed: false },
      data: { consumed: true },
    })

    await prisma.verificationCode.create({
      data: { email: normalizedEmail, code, expiresAt },
    })

    await sendVerificationEmail(normalizedEmail, code, locale)

    return NextResponse.json({ success: true, message: t(locale, "common.sentCode") })
  } catch (err) {
    console.log("[v0] send-code error:", err)
    return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
  }
}
