import { createHash } from "crypto"
import { NextResponse } from "next/server"
import { getOrCreateVerificationCode } from "@/lib/auth"
import { localeFromRequest, t } from "@/lib/i18n"
import { sendVerificationEmail } from "@/lib/mail"
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

    const { code, expiresAt, reused } = await getOrCreateVerificationCode(email)
    await sendVerificationEmail(email, code, locale)

    return ok({ expiresAt, reused })
  } catch (err) {
    console.log("[app/user/vericode/send] error:", err)
    return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
  }
}
