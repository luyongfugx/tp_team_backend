"use client"

import { useEffect } from "react"
import { getApps, initializeApp } from "firebase/app"
import { getAnalytics, isSupported } from "firebase/analytics"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.appId && firebaseConfig.measurementId)
}

export function FirebaseAnalytics() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!hasFirebaseConfig()) return

    let mounted = true
    isSupported()
      .then((supported) => {
        if (!mounted || !supported) return
        const app = getApps()[0] ?? initializeApp(firebaseConfig)
        getAnalytics(app)
      })
      .catch((error) => {
        console.warn("[firebase:analytics] init failed", error)
      })

    return () => {
      mounted = false
    }
  }, [])

  return null
}
