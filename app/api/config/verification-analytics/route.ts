import { NextResponse } from "next/server"
import { verificationAnalyticsConfig } from "@/lib/verification-analytics"

export const dynamic = "force-dynamic"

export async function GET() {
  const config = process.env.NODE_ENV === "production" ? verificationAnalyticsConfig(process.env) : null
  return NextResponse.json(config ? { enabled: true, ...config } : { enabled: false }, {
    headers: { "Cache-Control": "no-store" },
  })
}
