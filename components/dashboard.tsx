"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Camera, FolderKanban, LogOut, Mail, RefreshCw, Send, Users } from "lucide-react"

interface DashboardProps {
  token: string
  user: { id: string; email: string }
  expiresAt: string
  onLogout: () => void
}

type AdminRole = "SUPER_ADMIN" | "TEAM_OWNER"

type Overview = {
  role: AdminRole
  currentUser: { id: string; email: string; userName: string | null; avatar: string | null }
  summary: { teamCount: number; userCount: number; projectCount: number; photoCount: number }
  teams: TeamInfo[]
}

type TeamInfo = {
  groupID: string
  groupName: string
  owner: { id: string; email: string; userName: string | null; avatar: string | null }
  createdAt: string
  memberNum: number
  projectNum: number
  photoNum: number
  members: Array<{
    userID: string
    email: string
    userName: string | null
    avatar: string | null
    role: string
    roleID: number
    joinedAt: string
  }>
  projects: Array<{
    projectID: number
    projectName: string
    photoCount: number
    memberCount: number
    latestPhotoSmallURL: string | null
    createdAt: string
  }>
  photos: Array<{
    photoID: string
    projectName: string | null
    userName: string | null
    smallURL: string | null
    largeURL: string | null
    location: string | null
    takePhotoFormatTime: string
    createdAt: string
  }>
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function TestEmailPanel({ token, teams }: { token: string; teams: TeamInfo[] }) {
  const [email, setEmail] = useState("")
  const [groupID, setGroupID] = useState("")
  const [loadingType, setLoadingType] = useState<"" | "verification" | "invite">("")
  const [message, setMessage] = useState("")

  async function send(type: "verification" | "invite") {
    setLoadingType(type)
    setMessage("")
    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, email, groupID }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || "发送失败")
        return
      }
      setMessage(type === "verification" ? `验证码测试邮件已发送：${data.code}` : `邀请测试邮件已发送：${data.inviteCode}`)
    } catch {
      setMessage("网络错误，请稍后再试")
    } finally {
      setLoadingType("")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="size-5" />
          邮件模板测试
        </CardTitle>
        <CardDescription>总管理员可发送登录验证码和团队邀请测试邮件。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="test-email">收件邮箱</Label>
          <Input id="test-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="test-team">邀请邮件团队</Label>
          <select
            id="test-team"
            value={groupID}
            onChange={(event) => setGroupID(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">使用默认测试团队</option>
            {teams.map((team) => (
              <option key={team.groupID} value={team.groupID}>
                {team.groupName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={() => send("verification")} disabled={!email || loadingType !== ""} variant="outline">
            <Send className="size-4" />
            验证码
          </Button>
          <Button onClick={() => send("invite")} disabled={!email || loadingType !== ""}>
            <Send className="size-4" />
            邀请
          </Button>
        </div>
        {message && <p className="md:col-span-3 text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  )
}

function TeamSection({ team }: { team: TeamInfo }) {
  const latestPhotos = team.photos.filter((photo) => photo.smallURL || photo.largeURL)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-lg">{team.groupName}</CardTitle>
            <CardDescription>
              创建者：{team.owner.userName || team.owner.email} · {new Date(team.createdAt).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex gap-2 text-sm text-muted-foreground">
            <span>{team.memberNum} 成员</span>
            <span>{team.projectNum} 项目</span>
            <span>{team.photoNum} 照片</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-3">
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-medium">
            <Users className="size-4" />
            成员
          </h3>
          <div className="space-y-2">
            {team.members.slice(0, 8).map((member) => (
              <div key={member.userID} className="rounded-md border p-3 text-sm">
                <div className="font-medium">{member.userName || member.email}</div>
                <div className="text-muted-foreground">{member.role} · {member.email}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 font-medium">
            <FolderKanban className="size-4" />
            项目
          </h3>
          <div className="space-y-2">
            {team.projects.slice(0, 8).map((project) => (
              <div key={project.projectID} className="rounded-md border p-3 text-sm">
                <div className="font-medium">{project.projectName}</div>
                <div className="text-muted-foreground">{project.memberCount} 成员 · {project.photoCount} 照片</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 font-medium">
            <Camera className="size-4" />
            最新照片
          </h3>
          {latestPhotos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {latestPhotos.slice(0, 9).map((photo) => (
                <a key={photo.photoID} href={photo.largeURL || photo.smallURL || "#"} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.smallURL || photo.largeURL || ""} alt={photo.projectName || "photo"} className="aspect-square w-full rounded-md object-cover" />
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">暂无照片</div>
          )}
        </section>
      </CardContent>
    </Card>
  )
}

export function Dashboard({ token, user, onLogout }: DashboardProps) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const isSuperAdmin = overview?.role === "SUPER_ADMIN"
  const title = useMemo(() => {
    if (!overview) return "后台管理"
    return isSuperAdmin ? "总管理员后台" : "团队创建者后台"
  }, [isSuperAdmin, overview])

  async function loadOverview() {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/overview", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || "加载失败")
        return
      }
      setOverview(data)
    } catch {
      setMessage("网络错误，请稍后再试")
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

  useEffect(() => {
    loadOverview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="w-full max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadOverview} disabled={loading} variant="outline">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button onClick={logout} variant="outline">
            <LogOut className="size-4" />
            退出
          </Button>
        </div>
      </header>

      {message && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</div>}
      {loading && <div className="rounded-md border p-6 text-sm text-muted-foreground">正在加载后台数据...</div>}

      {overview && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<Building2 className="size-5" />} label="团队" value={overview.summary.teamCount} />
            <StatCard icon={<Users className="size-5" />} label="用户" value={overview.summary.userCount} />
            <StatCard icon={<FolderKanban className="size-5" />} label="项目" value={overview.summary.projectCount} />
            <StatCard icon={<Camera className="size-5" />} label="照片" value={overview.summary.photoCount} />
          </div>

          {isSuperAdmin && <TestEmailPanel token={token} teams={overview.teams} />}

          <div className="space-y-4">
            {overview.teams.map((team) => (
              <TeamSection key={team.groupID} team={team} />
            ))}
            {overview.teams.length === 0 && <div className="rounded-md border p-6 text-sm text-muted-foreground">暂无可管理团队</div>}
          </div>
        </>
      )}
    </div>
  )
}
