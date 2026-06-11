import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateCode, CODE_TTL_MS } from "@/lib/auth"
import { sendVerificationEmail } from "@/lib/mail"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 })
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
      return NextResponse.json({ error: "验证码发送过于频繁，请稍后再试" }, { status: 429 })
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

    await sendVerificationEmail(normalizedEmail, code)

    return NextResponse.json({ success: true, message: "验证码已发送" })
  } catch (err) {
    console.log("[v0] send-code error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
