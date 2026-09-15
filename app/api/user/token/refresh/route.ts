import { NextResponse } from "next/server"
import { getTokenFromRequest } from "@/lib/auth"
import { bad, ok, readBody, requireUser } from "@/app/api/_utils/api"
import { fillMissingUserRegistrationMetadata } from "@/lib/user-registration-metadata"

export async function POST(req: Request) {
  try {
    const token = getTokenFromRequest(req)
    if (!token) return bad("未授权或登录已过期", 401)
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    const body = await readBody(req)
    await fillMissingUserRegistrationMetadata(user, body)
    // Persistent sessions do not need rotation. Keep retries and lost responses from
    // revoking the credential that the client still has saved.
    return ok({ token })
  } catch (err) {
    console.log("[app/user/token/refresh] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
