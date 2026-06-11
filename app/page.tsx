"use client"

import { useState, useEffect } from "react"
import { LoginCard } from "@/components/login-card"
import { Dashboard } from "@/components/dashboard"

interface Auth {
  token: string
  expiresAt: string
  user: { id: string; email: string }
}

const STORAGE_KEY = "auth"

export default function Page() {
  const [auth, setAuth] = useState<Auth | null>(null)
  const [ready, setReady] = useState(false)

  // 从本地恢复登录态
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setAuth(JSON.parse(raw))
    } catch {}
    setReady(true)
  }, [])

  function handleSuccess(data: Auth) {
    setAuth(data)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  function handleLogout() {
    setAuth(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      {ready &&
        (auth ? (
          <Dashboard
            token={auth.token}
            user={auth.user}
            expiresAt={auth.expiresAt}
            onLogout={handleLogout}
          />
        ) : (
          <LoginCard onSuccess={handleSuccess} />
        ))}
    </main>
  )
}
