"use client"

import { useEffect } from "react"
import { getApps, initializeApp } from "firebase/app"
import { getAnalytics, isSupported } from "firebase/analytics"

type FirebaseAnalyticsConfig = {
  apiKey: string
  authDomain?: string
  projectId?: string
  storageBucket?: string
  messagingSenderId?: string
  appId: string
  measurementId: string
}

const buildTimeFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

function validFirebaseConfig(config: typeof buildTimeFirebaseConfig | FirebaseAnalyticsConfig): config is FirebaseAnalyticsConfig {
  return Boolean(config.apiKey && config.appId && config.measurementId)
}

async function runtimeFirebaseConfig() {
  try {
    const response = await fetch("/api/config/firebase-analytics", { cache: "no-store" })
    if (!response.ok) return null
    const payload = (await response.json()) as { config?: FirebaseAnalyticsConfig | null }
    return payload.config && validFirebaseConfig(payload.config) ? payload.config : null
  } catch (error) {
    console.warn("[firebase:analytics] runtime config failed", error)
    return null
  }
}

export function FirebaseAnalytics() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return

    let mounted = true
    async function initializeAnalytics() {
      try {
        const config = validFirebaseConfig(buildTimeFirebaseConfig)
          ? buildTimeFirebaseConfig
          : await runtimeFirebaseConfig()
        if (!mounted || !config || !(await isSupported())) return

        const appName = "timeprint-web-analytics"
        const app = getApps().find((item) => item.name === appName) ?? initializeApp(config, appName)
        getAnalytics(app)
      } catch (error) {
        console.warn("[firebase:analytics] init failed", error)
      }
    }

    void initializeAnalytics()

    return () => {
      mounted = false
    }
  }, [])

  return null
}
