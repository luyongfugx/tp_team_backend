import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { bad, ok, requireUser } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return bad("未授权或登录已过期", 401)
    return ok({ accountToken: randomBytes(32).toString("hex") })
  } catch (err) {
    console.log("[app/user/account/token] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
