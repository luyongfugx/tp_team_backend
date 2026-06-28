import { createHash } from "crypto"
import { NextResponse } from "next/server"
import { CODE_TTL_MS, generateCode } from "@/lib/auth"
import { localeFromRequest, t } from "@/lib/i18n"
import { sendVerificationEmail } from "@/lib/mail"
import { prisma } from "@/lib/prisma"
import { bad, EMAIL_RE, normalizeEmail, ok, readBody } from "@/app/api/_utils/api"

function validSign(email: string, req: Request) {
  const signKey = process.env.EMAIL_SIGN_KEY
  if (!signKey) return true
  const signID = req.headers.get("x-sign-id")
  const expected = createHash("md5").update(`${email}${signKey}`).digest("hex")
  return signID === expected
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const locale = localeFromRequest(req, body)
    const email = normalizeEmail(body.email || req.headers.get("email"))
    if (!email || !EMAIL_RE.test(email)) return bad(t(locale, "common.invalidEmail"))
    if (!validSign(email, req)) return bad("签名不正确", 403)

    const recent = await prisma.verificationCode.findFirst({
      where: { email, createdAt: { gt: new Date(Date.now() - 60 * 1000) } },
      orderBy: { createdAt: "desc" },
    })
    if (recent) return bad(t(locale, "common.tooFrequent"), 429)

    await prisma.verificationCode.updateMany({
      where: { email, consumed: false },
      data: { consumed: true },
    })

    const code = generateCode()
    await prisma.verificationCode.create({
      data: { email, code, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    })
    await sendVerificationEmail(email, code, locale)

    return ok()
  } catch (err) {
    console.log("[app/user/vericode/send] error:", err)
    return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
  }
}
