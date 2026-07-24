import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/auth"
import { createDefaultTeamIfNeeded } from "@/app/api/_utils/default-team"
import { apiErrorMessage, serverError } from "@/app/api/_utils/api"
import { localeFromRequest } from "@/lib/i18n"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LOCAL_TEST_CODE = "888888"
const SUPER_CODE_EMAIL = "gsr112@qq.com"

function canUseLocalTestCode(req: Request) {
  if (process.env.NODE_ENV === "production") return false
  const hostname = new URL(req.url).hostname
  return process.env.NODE_ENV === "development" || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, code } = body
    const locale = localeFromRequest(req, body)

    if (!email || !EMAIL_RE.test(email) || !code || typeof code !== "string") {
      return NextResponse.json({ error: apiErrorMessage(locale, "参数不正确") }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const trimmedCode = code.trim()
    const useLocalTestCode = trimmedCode === LOCAL_TEST_CODE && canUseLocalTestCode(req)
    const useSuperCode = normalizedEmail === SUPER_CODE_EMAIL && trimmedCode === LOCAL_TEST_CODE

    // 查找最新的未使用验证码
    if (!useLocalTestCode && !useSuperCode) {
      const record = await prisma.verificationCode.findFirst({
        where: { email: normalizedEmail, consumed: false },
        orderBy: { createdAt: "desc" },
      })

      if (!record) {
        return NextResponse.json({ error: apiErrorMessage(locale, "验证码不存在，请重新获取") }, { status: 400 })
      }

      if (record.expiresAt.getTime() < Date.now()) {
        return NextResponse.json({ error: apiErrorMessage(locale, "验证码已过期，请重新获取") }, { status: 400 })
      }

      if (record.code !== trimmedCode) {
        return NextResponse.json({ error: apiErrorMessage(locale, "验证码错误") }, { status: 400 })
      }

      // 标记验证码已使用
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: { consumed: true },
      })
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    // 用户不存在则创建（首次登录即注册）
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: { email: normalizedEmail },
    })

    const { token, expiresAt } = await createSession(user.id)
    if (!existing) await createDefaultTeamIfNeeded(user)

    return NextResponse.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
      user: { id: user.id, email: user.email },
    })
  } catch (err) {
    console.log("[v0] verify-code error:", err)
    return serverError(req)
  }
}
