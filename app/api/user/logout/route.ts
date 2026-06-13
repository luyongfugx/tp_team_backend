import { NextResponse } from "next/server"
import { getTokenFromRequest } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ok } from "@/app/api/_utils/api"

export async function POST(req: Request) {
  try {
    const token = getTokenFromRequest(req)
    if (token) await prisma.session.deleteMany({ where: { token } }).catch(() => {})
    return ok()
  } catch (err) {
    console.log("[app/user/logout] error:", err)
    return NextResponse.json({ error: "服务器错误，请稍后再试" }, { status: 500 })
  }
}
