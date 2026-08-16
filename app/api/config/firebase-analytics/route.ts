import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function runtimeEnv(name: string) {
  const value = process.env[name]
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export async function GET() {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.json({ enabled: false, config: null }, { headers: { "Cache-Control": "no-store" } })
  }

  const config = {
    apiKey: runtimeEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: runtimeEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: runtimeEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: runtimeEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: runtimeEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: runtimeEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
    measurementId: runtimeEnv("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"),
  }
  const enabled = Boolean(config.apiKey && config.appId && config.measurementId)

  return NextResponse.json(
    { enabled, config: enabled ? config : null },
    { headers: { "Cache-Control": "no-store" } },
  )
}
