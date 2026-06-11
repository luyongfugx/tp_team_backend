"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, RefreshCw, LogOut } from "lucide-react"

interface DashboardProps {
  token: string
  user: { id: string; email: string }
  expiresAt: string
  onLogout: () => void
}

export function Dashboard({ token, user, expiresAt, onLogout }: DashboardProps) {
  const [currentExpiry, setCurrentExpiry] = useState(expiresAt)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function callProtected() {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || "请求失败")
        return
      }
      setCurrentExpiry(data.expiresAt)
      setMessage("访问成功，token 过期时间已刷新")
    } catch {
      setMessage("网络错误")
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
    onLogout()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CheckCircle2 className="size-5" />
        </div>
        <CardTitle className="text-xl">登录成功</CardTitle>
        <CardDescription>欢迎回来，{user.email}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
          <p className="text-muted-foreground">Token（请求头需携带 Bearer）</p>
          <p className="break-all font-mono text-xs">{token}</p>
        </div>

        <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
          <p className="text-muted-foreground">Token 过期时间</p>
          <p className="font-mono text-xs">{new Date(currentExpiry).toLocaleString()}</p>
        </div>

        {message && <p className="text-sm text-primary">{message}</p>}

        <div className="flex flex-col gap-2">
          <Button onClick={callProtected} disabled={loading} className="w-full">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            访问受保护接口 /api/me（刷新过期时间）
          </Button>
          <Button onClick={logout} variant="outline" className="w-full">
            <LogOut className="size-4" />
            退出登录
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
