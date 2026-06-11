import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTokenFromRequest } from "@/lib/auth"

export async function POST(req: Request) {
  const token = getTokenFromRequest(req)
  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => {})
  }
  return NextResponse.json({ success: true })
}
