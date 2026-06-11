import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/auth"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json()

    if (!email || !EMAIL_RE.test(email) || !code || typeof code !== "string") {
      return NextResponse.json({ error: "参数不正确" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // 查找最新的未使用验证码
    const record = await prisma.verificationCode.findFirst({
      where: { email: normalizedEmail, consumed: false },
      orderBy: { createdAt: "desc" },
    })

    if (!record) {
      return NextResponse.json({ error: "验证码不存在，请重新获取" }, { status: 400 })
    }

    if (record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "验证码已过期，请重新获取" }, { status: 400 })
    }

    if (record.code !== code.trim()) {
      return NextResponse.json({ error: "验证码错误" }, { status: 400 })
    }

    // 标记验证码已使用
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumed: true },
    })

    // 用户不存在则创建（首次登录即注册）
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: { email: normalizedEmail },
    })

    const { token, expiresAt } = await createSession(user.id)

    return NextResponse.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
      user: { id: user.id, email: user.email },
    })
  } catch (err) {
    console.log("[v0] verify-code error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
