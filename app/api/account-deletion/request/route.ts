import { NextResponse } from "next/server"
import { accountDeletionPayload, accountDeletionRequest, clientIP } from "@/app/api/account-deletion/_utils/account-deletion"
import { EMAIL_RE, normalizeEmail, readBody } from "@/app/api/_utils/api"
import { localeFromRequest, t } from "@/lib/i18n"

export async function POST(req: Request) {
  try {
    const body = await readBody(req)
    const locale = localeFromRequest(req, body)
    const email = normalizeEmail(body.email)
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: t(locale, "deleteAccount.invalidEmail") }, { status: 400 })
    }

    const request = await accountDeletionRequest().create({
      data: {
        email,
        locale,
        status: "PENDING",
        ip: clientIP(req),
        userAgent: req.headers.get("user-agent"),
      },
    })

    return NextResponse.json({ request: accountDeletionPayload(request), message: t(locale, "deleteAccount.submitSuccess") })
  } catch (err) {
    console.log("[app/account-deletion/request] error:", err)
    return NextResponse.json({ error: t(localeFromRequest(req), "common.serverError") }, { status: 500 })
  }
}
