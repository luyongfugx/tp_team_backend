"use client"

import { useEffect } from "react"
import { getApps, initializeApp } from "firebase/app"
import { getAnalytics, isSupported } from "firebase/analytics"

const firebaseConfig = {
  apiKey: "AIzaSyB5GDUvXQQK0126IZaokBT57vHyEbGhDKg",
  authDomain: "team-web-4f79d.firebaseapp.com",
  projectId: "team-web-4f79d",
  storageBucket: "team-web-4f79d.firebasestorage.app",
  messagingSenderId: "649651524454",
  appId: "1:649651524454:web:9d6f59ad06be592c276ea7",
  measurementId: "G-Z9HJ16FDTS",
}

export function FirebaseAnalytics() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return

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
