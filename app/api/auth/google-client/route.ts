import { NextResponse } from "next/server"

function googleClientID() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_WEB_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_IDS?.split(",")[0]?.trim() ||
    ""
  )
}

export async function GET() {
  return NextResponse.json({ clientID: googleClientID() })
}
