"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderKanban,
  ImageOff,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  ArrowRight,
  Settings,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { clientLocale, localeDateCode, LOCALE_CHANGE_EVENT, resolveLocale, t } from "@/lib/i18n"

interface DashboardProps {
  token: string
  user: { id: string; email: string }
  expiresAt: string
  onLogout: () => void
}

type AdminRole = "SUPER_ADMIN" | "TEAM_OWNER"
const TEAM_PAGE_SIZE = 50
const PHOTO_DAY_PAGE_SIZE = 10
type MainMenu = "teams" | "settings"
type DetailView =
  | { type: "teams" }
  | { type: "team"; teamID: string; tab: "projects" | "members" }
  | { type: "project"; teamID: string; projectID: number }
  | { type: "member"; teamID: string; userID: string }
  | { type: "teamPhotos"; teamID: string }

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
  currentMember: { userID: string; role: string; roleID: number } | null
  memberNum: number
  projectNum: number
  photoNum: number
  members: TeamMember[]
  projects: TeamProject[]
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

type TeamMember = {
  userID: string
  email: string
  userName: string | null
  avatar: string | null
  role: string
  roleID: number
  joinedAt: string
}

type TeamProject = {
  projectID: number
  projectName: string
  photoCount: number
  memberCount: number
  latestPhotoSmallURL: string | null
  latestPhotoTimestamp?: number | null
  createdAt: string
  addressInfo?: {
    lat: number | null
    lng: number | null
    address: string | null
    circle: number | null
    distanceUnit: string | null
    removeAddress: boolean
  }
}

type TeamPhoto = {
  photoID: string
  imageURL: string | null
  thumbnailURL: string | null
  downloadURL: string
  localPhotoName: string | null
  location: string | null
  userName: string | null
  projectName: string | null
  timeText: string
}

type TeamPhotoDay = {
  dateText: string
  photos: TeamPhoto[]
}

type TeamPhotosPayload = {
  team: { groupID: string; groupName: string }
  project?: { projectID: number; projectName: string } | null
  member?: { userID: string; user: { id: string; email: string; userName: string | null } } | null
  totalCount: number
  totalDays: number
  page: number
  pageSize: number
  totalPages: number
  days: TeamPhotoDay[]
}

function formatDate(value: string | number | null | undefined, locale: string) {
  if (!value) return "-"
  const date = typeof value === "number" ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString(localeDateCode(resolveLocale(locale)))
}

function teamAddress(team: TeamInfo) {
  return team.projects.find((project) => project.addressInfo?.address)?.addressInfo?.address
}

function ownerName(team: TeamInfo) {
  return team.owner.userName || team.owner.email
}

function canManageTeam(team: TeamInfo | null, isSuperAdmin: boolean) {
  return isSuperAdmin || team?.currentMember?.roleID === 1 || team?.currentMember?.roleID === 2
}

function roleNameFromID(roleID: number, locale: string) {
  if (roleID === 1) return t(locale, "role.owner")
  if (roleID === 2) return t(locale, "role.admin")
  return t(locale, "role.member")
}

function photoCacheKey(teamID: string, options?: { projectID?: number; userID?: string }) {
  if (options?.projectID != null) return `project:${teamID}:${options.projectID}`
  if (options?.userID) return `member:${teamID}:${options.userID}`
  return `team:${teamID}`
}

function menuButtonClass(active: boolean, collapsed: boolean) {
  return [
    "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
    active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    collapsed ? "justify-center px-0" : "",
  ].join(" ")
}

function CollapsedTooltip({ collapsed, label }: { collapsed: boolean; label: string }) {
  if (!collapsed) return null
  return (
    <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition group-hover:opacity-100">
      {label}
    </span>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>
}

function DataTable({
  columns,
  children,
}: {
  columns: string[]
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">{children}</tbody>
        </table>
      </div>
    </div>
  )
}

function StatItem({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  onClick?: () => void
}) {
  const Component = onClick ? "button" : "div"
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-lg border bg-background p-4 text-left ${onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:border-foreground/35 hover:bg-muted/40 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          {label}
        </span>
        {onClick && <ArrowRight className="size-4 shrink-0" />}
      </div>
      <div className="mt-2 truncate text-xl font-semibold">{value}</div>
    </Component>
  )
}

function PhotoDayGrid({
  locale,
  payload,
  loading,
  emptyText,
  onOpenPhoto,
  selectionEnabled = false,
  selectedPhotoIDs,
  onTogglePhoto,
}: {
  locale: string
  payload: TeamPhotosPayload | undefined
  loading: boolean
  emptyText: string
  onOpenPhoto: (photo: TeamPhoto) => void
  selectionEnabled?: boolean
  selectedPhotoIDs?: Set<string>
  onTogglePhoto?: (photoID: string) => void
}) {
  if (loading) return <div className="rounded-md border bg-background p-6 text-sm text-muted-foreground">{t(locale, "dashboard.loadingPhotos")}</div>
  if (!payload) return <EmptyState>{t(locale, "dashboard.noPhotoData")}</EmptyState>
  if (payload.days.length === 0) return <EmptyState>{emptyText}</EmptyState>

  return (
    <div className="space-y-8">
      {payload.days.map((day) => (
        <section key={day.dateText}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">{day.dateText}</h2>
            <span className="text-sm text-muted-foreground">{t(locale, "dashboard.photoUnit", { count: day.photos.length })}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {day.photos.map((photo) => (
              <div key={photo.photoID} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted/40">
                {selectionEnabled && (
                  <button
                    type="button"
                    onClick={() => onTogglePhoto?.(photo.photoID)}
                    className={`absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border text-xs font-semibold text-white shadow-sm transition ${
                      selectedPhotoIDs?.has(photo.photoID)
                        ? "border-[#2563eb] bg-[#2563eb]"
                        : "border-white bg-white hover:bg-white/90"
                    }`}
                    aria-label={selectedPhotoIDs?.has(photo.photoID) ? t(locale, "dashboard.unselectPhoto") : t(locale, "dashboard.selectPhoto")}
                  >
                    {selectedPhotoIDs?.has(photo.photoID) ? "✓" : ""}
                  </button>
                )}
                {photo.thumbnailURL ? (
                  <button
                    type="button"
                    onClick={() => selectionEnabled ? onTogglePhoto?.(photo.photoID) : onOpenPhoto(photo)}
                    className="block size-full text-left"
                    aria-label={t(locale, "dashboard.viewPhoto")}
                  >
                    <img
                      src={photo.thumbnailURL}
                      alt={photo.localPhotoName || photo.location || t(locale, "dashboard.photos")}
                      className="size-full object-cover transition duration-200 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => selectionEnabled ? onTogglePhoto?.(photo.photoID) : onOpenPhoto(photo)}
                    className="flex size-full items-center justify-center text-muted-foreground"
                    aria-label={t(locale, "dashboard.viewPhoto")}
                  >
                    <ImageOff className="size-8" />
                  </button>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-2">
                  <p className="truncate text-xs font-medium text-white">{photo.timeText}</p>
                  <p className="truncate text-xs text-white/75">{photo.projectName || photo.userName || photo.location || ""}</p>
                </div>
                <a
                  href={photo.downloadURL}
                  className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition hover:bg-black/75 group-hover:opacity-100"
                  aria-label={t(locale, "web.downloadImage")}
                >
                  <Download className="size-4" />
                </a>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function PhotoSelectionToolbar({
  locale,
  disabled,
  selectionMode,
  selectedCount,
  downloading,
  onSelect,
  onSelectAll,
  onInvert,
  onClear,
  onDownload,
}: {
  locale: string
  disabled: boolean
  selectionMode: boolean
  selectedCount: number
  downloading: boolean
  onSelect: () => void
  onSelectAll: () => void
  onInvert: () => void
  onClear: () => void
  onDownload: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      <Button variant="outline" size="sm" disabled={disabled} onClick={onSelect}>
        {t(locale, "dashboard.select")}
      </Button>
      {selectionMode && (
        <>
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            {t(locale, "dashboard.selectAll")}
          </Button>
          <Button variant="outline" size="sm" onClick={onInvert}>
            {t(locale, "dashboard.invertSelection")}
          </Button>
          <Button variant="outline" size="sm" onClick={onClear}>
            {t(locale, "dashboard.clearSelection")}
          </Button>
          <Button size="sm" disabled={selectedCount === 0 || downloading} onClick={onDownload}>
            <Download className="size-4" />
            {downloading
              ? t(locale, "dashboard.zipping")
              : t(locale, "dashboard.downloadSelected", { count: selectedCount ? `(${selectedCount})` : "" })}
          </Button>
        </>
      )}
    </div>
  )
}

function PhotoSelectionHint({ locale, count }: { locale: string; count: number }) {
  return (
    <div className="mb-4 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
      {t(locale, "dashboard.selectionHint", { count })}
    </div>
  )
}

function PhotoPagination({
  locale,
  payload,
  loading,
  onPageChange,
}: {
  locale: string
  payload: TeamPhotosPayload | undefined
  loading: boolean
  onPageChange: (page: number) => void
}) {
  if (!payload || payload.totalDays <= 0) return null
  const currentPage = payload.page
  const totalPages = Math.max(1, payload.totalPages)
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-lg border bg-background p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        {t(locale, "dashboard.pageSummary", {
          page: currentPage,
          totalPages,
          totalDays: payload.totalDays,
          pageSize: payload.pageSize,
        })}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={loading || currentPage <= 1} onClick={() => onPageChange(1)}>
          {t(locale, "dashboard.firstPage")}
        </Button>
        <Button variant="outline" size="sm" disabled={loading || currentPage <= 1} onClick={() => onPageChange(Math.max(1, currentPage - 1))}>
          {t(locale, "dashboard.prevPage")}
        </Button>
        <Button variant="outline" size="sm" disabled={loading || currentPage >= totalPages} onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}>
          {t(locale, "dashboard.nextPage")}
        </Button>
        <Button variant="outline" size="sm" disabled={loading || currentPage >= totalPages} onClick={() => onPageChange(totalPages)}>
          {t(locale, "dashboard.lastPage")}
        </Button>
      </div>
    </div>
  )
}

export function Dashboard({ token, user, onLogout }: DashboardProps) {
  const [locale, setLocale] = useState("zh-Hans")
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [collapsed, setCollapsed] = useState(false)
  const [activeMenu, setActiveMenu] = useState<MainMenu>("teams")
  const [view, setView] = useState<DetailView>({ type: "teams" })
  const [teamPage, setTeamPage] = useState(1)
  const [teamPhotos, setTeamPhotos] = useState<Record<string, TeamPhotosPayload>>({})
  const [photoPages, setPhotoPages] = useState<Record<string, number>>({})
  const [photosLoading, setPhotosLoading] = useState(false)
  const [activePhoto, setActivePhoto] = useState<TeamPhoto | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedPhotoIDs, setSelectedPhotoIDs] = useState<Set<string>>(new Set())
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [memberActionLoading, setMemberActionLoading] = useState<"" | "invite" | string>("")

  const isSuperAdmin = overview?.role === "SUPER_ADMIN"
  const selectedTeam = useMemo(() => {
    if (!overview || view.type === "teams") return null
    return overview.teams.find((team) => team.groupID === view.teamID) || null
  }, [overview, view])
  const selectedProject = useMemo(() => {
    if (!selectedTeam || view.type !== "project") return null
    return selectedTeam.projects.find((project) => project.projectID === view.projectID) || null
  }, [selectedTeam, view])
  const selectedMember = useMemo(() => {
    if (!selectedTeam || view.type !== "member") return null
    return selectedTeam.members.find((member) => member.userID === view.userID) || null
  }, [selectedTeam, view])
  const teamPageCount = Math.max(1, Math.ceil((overview?.teams.length || 0) / TEAM_PAGE_SIZE))
  const currentTeamPage = Math.min(teamPage, teamPageCount)
  const pagedTeams = useMemo(() => {
    if (!overview) return []
    const start = (currentTeamPage - 1) * TEAM_PAGE_SIZE
    return overview.teams.slice(start, start + TEAM_PAGE_SIZE)
  }, [currentTeamPage, overview])

  async function loadOverview() {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/overview", {
        headers: { Authorization: `Bearer ${token}`, "x-locale": locale },
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || t(locale, "common.sendFailed"))
        return
      }
      setOverview(data)
    } catch {
      setMessage(t(locale, "common.networkError"))
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

  async function loadPhotos(teamID: string, options?: { projectID?: number; userID?: string; page?: number }) {
    const key = photoCacheKey(teamID, options)
    const page = options?.page || photoPages[key] || 1

    setPhotosLoading(true)
    setMessage("")
    try {
      const url = new URL("/api/admin/team-photos", window.location.origin)
      url.searchParams.set("groupID", teamID)
      if (options?.projectID != null) url.searchParams.set("projectID", String(options.projectID))
      if (options?.userID) url.searchParams.set("userID", options.userID)
      url.searchParams.set("locale", locale)
      url.searchParams.set("page", String(page))
      url.searchParams.set("pageSize", String(PHOTO_DAY_PAGE_SIZE))
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}`, "x-locale": locale },
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || t(locale, "common.sendFailed"))
        return
      }
      setPhotoPages((items) => ({ ...items, [key]: data.page || page }))
      setTeamPhotos((items) => ({ ...items, [key]: data }))
    } catch {
      setMessage(t(locale, "common.networkError"))
    } finally {
      setPhotosLoading(false)
    }
  }

  async function openTeamPhotos(teamID: string) {
    setActiveMenu("teams")
    setView({ type: "teamPhotos", teamID })
    setActivePhoto(null)
    setSelectionMode(false)
    setSelectedPhotoIDs(new Set())
    await loadPhotos(teamID, { page: photoPages[photoCacheKey(teamID)] || 1 })
  }

  async function changePhotoPage(teamID: string, page: number, options?: { projectID?: number; userID?: string }) {
    const key = photoCacheKey(teamID, options)
    setPhotoPages((items) => ({ ...items, [key]: page }))
    setSelectionMode(false)
    setSelectedPhotoIDs(new Set())
    await loadPhotos(teamID, { ...options, page })
  }

  function openTeamFromList(team: TeamInfo) {
    setActiveMenu("teams")
    if (!canManageTeam(team, isSuperAdmin) && team.currentMember?.userID) {
      setView({ type: "member", teamID: team.groupID, userID: team.currentMember.userID })
      return
    }
    setView({ type: "team", teamID: team.groupID, tab: "projects" })
  }

  function photoIDsForKey(key: string) {
    return teamPhotos[key]?.days.flatMap((day) => day.photos.map((photo) => photo.photoID)) || []
  }

  function selectAllPhotos(key: string) {
    setSelectionMode(true)
    setSelectedPhotoIDs(new Set(photoIDsForKey(key)))
  }

  function invertPhotoSelection(key: string) {
    const ids = photoIDsForKey(key)
    setSelectionMode(true)
    setSelectedPhotoIDs((selected) => new Set(ids.filter((id) => !selected.has(id))))
  }

  function clearTeamPhotoSelection() {
    setSelectedPhotoIDs(new Set())
  }

  function togglePhotoSelection(photoID: string) {
    setSelectedPhotoIDs((selected) => {
      const next = new Set(selected)
      if (next.has(photoID)) next.delete(photoID)
      else next.add(photoID)
      return next
    })
  }

  async function downloadSelectedPhotos({
    team,
    projectID,
    userID,
  }: {
    team: TeamInfo
    projectID?: number
    userID?: string
  }) {
    if (selectedPhotoIDs.size === 0) return
    setDownloadingZip(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/team-photos/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ groupID: team.groupID, projectID, userID, photoIDs: Array.from(selectedPhotoIDs) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMessage(data.error || t(locale, "dashboard.downloadFailed"))
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") || ""
      const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/)
      const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : `${team.groupName}${t(locale, "dashboard.teamPhotosZip")}`
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setMessage(t(locale, "common.networkError"))
    } finally {
      setDownloadingZip(false)
    }
  }

  async function inviteTeamMember(team: TeamInfo) {
    const email = inviteEmail.trim()
    if (!email) return
    setMemberActionLoading("invite")
    setMessage("")
    try {
      const res = await fetch("/api/group/user/invite/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-locale": locale,
        },
        body: JSON.stringify({ groupID: team.groupID, emails: [email], roleID: 3 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || t(locale, "dashboard.inviteFailed"))
        return
      }
      const failed = data.failedSendEmails?.length ? t(locale, "dashboard.inviteMailFailed", { emails: data.failedSendEmails.join(", ") }) : ""
      const already = data.alreadyMemberEmails?.length ? t(locale, "dashboard.alreadyMember", { emails: data.alreadyMemberEmails.join(", ") }) : ""
      setMessage(t(locale, "dashboard.inviteHandled", { failed, already }))
      setInviteEmail("")
      await loadOverview()
    } catch {
      setMessage(t(locale, "common.networkError"))
    } finally {
      setMemberActionLoading("")
    }
  }

  async function deleteTeamMember(team: TeamInfo, member: TeamMember) {
    if (member.userID === user.id || member.roleID === 1) return
    const confirmed = window.confirm(t(locale, "dashboard.confirmDeleteMember", { name: member.userName || member.email }))
    if (!confirmed) return
    setMemberActionLoading(member.userID)
    setMessage("")
    try {
      const res = await fetch("/api/group/user/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-locale": locale,
        },
        body: JSON.stringify({ groupID: team.groupID, deletedUserIDs: [member.userID] }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || t(locale, "dashboard.deleteFailed"))
        return
      }
      setMessage(data.deletedCount > 0 ? t(locale, "dashboard.memberDeleted") : t(locale, "dashboard.noMemberDeleted"))
      await loadOverview()
    } catch {
      setMessage(t(locale, "common.networkError"))
    } finally {
      setMemberActionLoading("")
    }
  }

  useEffect(() => {
    setLocale(clientLocale())
    function handleLocaleChange(event: Event) {
      setLocale(resolveLocale((event as CustomEvent).detail))
    }
    window.addEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange)
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange)
  }, [])

  useEffect(() => {
    loadOverview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, locale])

  useEffect(() => {
    setTeamPhotos({})
    setPhotoPages({})
  }, [locale])

  useEffect(() => {
    setTeamPage((page) => Math.min(page, teamPageCount))
  }, [teamPageCount])

  useEffect(() => {
    setSelectionMode(false)
    setSelectedPhotoIDs(new Set())
  }, [view])

  useEffect(() => {
    if (activeMenu !== "teams" || view.type !== "teamPhotos") return
    loadPhotos(view.teamID)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu, view, token, locale])

  useEffect(() => {
    if (activeMenu !== "teams" || view.type !== "project") return
    loadPhotos(view.teamID, { projectID: view.projectID })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu, view, token, locale])

  useEffect(() => {
    if (activeMenu !== "teams" || view.type !== "member") return
    loadPhotos(view.teamID, { userID: view.userID })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu, view, token, locale])

  function openTeams() {
    setActiveMenu("teams")
    setView({ type: "teams" })
  }

  function openSettings() {
    setActiveMenu("settings")
  }

  const title =
    activeMenu === "settings"
      ? t(locale, "dashboard.settings")
      : view.type === "team"
        ? selectedTeam?.groupName || t(locale, "dashboard.teamDetail")
        : view.type === "teamPhotos"
          ? t(locale, "dashboard.teamPhotosTitle", { team: selectedTeam?.groupName || t(locale, "dashboard.teams") })
        : view.type === "project"
          ? selectedProject?.projectName || t(locale, "dashboard.projectDetail")
          : view.type === "member"
            ? selectedMember?.userName || selectedMember?.email || t(locale, "dashboard.memberDetail")
            : t(locale, "dashboard.myTeams")

  return (
    <div className="flex min-h-svh w-full overflow-hidden bg-background">
      <aside className={`${collapsed ? "w-16" : "w-60"} flex shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200`}>
        <div className={`flex h-16 items-center border-b ${collapsed ? "justify-between px-1.5" : "justify-between px-3"}`}>
          <div className={`flex min-w-0 items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
            <img src="/logo.png" alt="Timeprint" className={`${collapsed ? "size-7 rounded-md" : "size-8 rounded-lg"} shrink-0 object-contain`} />
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate font-semibold">Timeprint</div>
                <div className="truncate text-xs text-sidebar-foreground/60">{isSuperAdmin ? t(locale, "dashboard.superAdminShort") : t(locale, "dashboard.teamAdminShort")}</div>
              </div>
            )}
            </div>
          <Button variant="ghost" size={collapsed ? "icon-sm" : "icon"} onClick={() => setCollapsed((value) => !value)} aria-label={t(locale, "dashboard.collapseMenu")}>
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <div className="group relative">
            <button type="button" className={menuButtonClass(activeMenu === "teams", collapsed)} onClick={openTeams} title={t(locale, "dashboard.myTeams")}>
              <Building2 className="size-4" />
              {!collapsed && <span>{t(locale, "dashboard.myTeams")}</span>}
            </button>
            <CollapsedTooltip collapsed={collapsed} label={t(locale, "dashboard.myTeams")} />
          </div>
          <div className="group relative">
            <button type="button" className={menuButtonClass(activeMenu === "settings", collapsed)} onClick={openSettings} title={t(locale, "dashboard.settings")}>
              <Settings className="size-4" />
              {!collapsed && <span>{t(locale, "dashboard.settings")}</span>}
            </button>
            <CollapsedTooltip collapsed={collapsed} label={t(locale, "dashboard.settings")} />
          </div>
        </nav>

        <div className="border-t p-3">
          {!collapsed && <div className="mb-3 truncate text-xs text-sidebar-foreground/60">{user.email}</div>}
          <div className="group relative">
            <Button onClick={logout} variant="outline" className="w-full" size={collapsed ? "icon" : "default"} title={t(locale, "dashboard.logout")}>
              <LogOut className="size-4" />
              {!collapsed && t(locale, "dashboard.logout")}
            </Button>
            <CollapsedTooltip collapsed={collapsed} label={t(locale, "dashboard.logout")} />
          </div>
        </div>
      </aside>

      <section className="min-w-0 flex-1 bg-background">
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{title}</h1>
            <p className="truncate text-xs text-muted-foreground">{activeMenu === "teams" ? t(locale, "dashboard.teamNavHint") : user.email}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={loadOverview} disabled={loading} variant="outline">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              {t(locale, "dashboard.refresh")}
            </Button>
            <LanguageSwitcher locale={locale} onLocaleChange={setLocale} />
          </div>
        </header>

        <main className="h-[calc(100svh-4rem)] overflow-auto p-4 md:p-6">
          {message && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</div>}
              {loading && <div className="rounded-md border bg-background p-6 text-sm text-muted-foreground">{t(locale, "common.loading")}</div>}
          {!loading && overview && activeMenu === "teams" && view.type === "teams" && (
            <div className="space-y-4">
              <DataTable columns={[
                t(locale, "dashboard.teamName"),
                t(locale, "dashboard.createdAt"),
                t(locale, "dashboard.ownerName"),
                t(locale, "dashboard.memberCountLabel"),
                t(locale, "dashboard.projectCountLabel"),
                t(locale, "dashboard.photoCountLabel"),
                t(locale, "dashboard.actions"),
              ]}>
                {pagedTeams.map((team) => (
                  <tr key={team.groupID} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{team.groupName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(team.createdAt, locale)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{ownerName(team)}</td>
                    <td className="px-4 py-3">{team.memberNum}</td>
                    <td className="px-4 py-3">{team.projectNum}</td>
                    <td className="px-4 py-3">{team.photoNum}</td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" onClick={() => openTeamFromList(team)}>
                        {t(locale, "dashboard.view")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </DataTable>
              {overview.teams.length === 0 && <EmptyState>{t(locale, "dashboard.noTeams")}</EmptyState>}
              {overview.teams.length > 0 && (
                <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {t(locale, "dashboard.teamListPageSummary", {
                      page: currentTeamPage,
                      totalPages: teamPageCount,
                      count: overview.teams.length,
                      pageSize: TEAM_PAGE_SIZE,
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentTeamPage <= 1}
                      onClick={() => setTeamPage(1)}
                    >
                      {t(locale, "dashboard.firstPage")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentTeamPage <= 1}
                      onClick={() => setTeamPage((page) => Math.max(page - 1, 1))}
                    >
                      {t(locale, "dashboard.prevPage")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentTeamPage >= teamPageCount}
                      onClick={() => setTeamPage((page) => Math.min(page + 1, teamPageCount))}
                    >
                      {t(locale, "dashboard.nextPage")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentTeamPage >= teamPageCount}
                      onClick={() => setTeamPage(teamPageCount)}
                    >
                      {t(locale, "dashboard.lastPage")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && overview && activeMenu === "teams" && view.type === "team" && selectedTeam && (
            <div className="space-y-4">
              <Button variant="ghost" onClick={() => setView({ type: "teams" })}>
                <ArrowLeft className="size-4" />
                {t(locale, "dashboard.backTeamList")}
              </Button>

              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle className="text-lg">{selectedTeam.groupName}</CardTitle>
                  <CardDescription>{t(locale, "dashboard.createdByAt", { owner: ownerName(selectedTeam), time: formatDate(selectedTeam.createdAt, locale) })}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <StatItem
                    icon={<Users className="size-4" />}
                    label={t(locale, "dashboard.memberCountLabel")}
                    value={selectedTeam.memberNum}
                    onClick={() => setView({ type: "team", teamID: selectedTeam.groupID, tab: "members" })}
                  />
                  <StatItem
                    icon={<FolderKanban className="size-4" />}
                    label={t(locale, "dashboard.projectCountLabel")}
                    value={selectedTeam.projectNum}
                    onClick={() => setView({ type: "team", teamID: selectedTeam.groupID, tab: "projects" })}
                  />
                  <StatItem
                    icon={<Camera className="size-4" />}
                    label={t(locale, "dashboard.photoCountLabel")}
                    value={selectedTeam.photoNum}
                    onClick={() => openTeamPhotos(selectedTeam.groupID)}
                  />
                  <StatItem icon={<Building2 className="size-4" />} label={t(locale, "dashboard.teamName")} value={selectedTeam.groupName} />
                  <StatItem icon={<MapPin className="size-4" />} label={t(locale, "dashboard.address")} value={teamAddress(selectedTeam) || t(locale, "dashboard.noAddress")} />
                </CardContent>
              </Card>

              <div className="flex border-b">
                <button
                  type="button"
                  onClick={() => setView({ type: "team", teamID: selectedTeam.groupID, tab: "projects" })}
                  className={`border-b-2 px-4 py-3 text-sm font-medium ${view.tab === "projects" ? "border-foreground" : "border-transparent text-muted-foreground"}`}
                >
                  {t(locale, "dashboard.projectList")}
                </button>
                <button
                  type="button"
                  onClick={() => setView({ type: "team", teamID: selectedTeam.groupID, tab: "members" })}
                  className={`border-b-2 px-4 py-3 text-sm font-medium ${view.tab === "members" ? "border-foreground" : "border-transparent text-muted-foreground"}`}
                >
                  {t(locale, "dashboard.memberList")}
                </button>
              </div>

              {view.tab === "projects" && (
                <>
                  <DataTable columns={[
                    t(locale, "dashboard.projectName"),
                    t(locale, "dashboard.address"),
                    t(locale, "dashboard.memberCountLabel"),
                    t(locale, "dashboard.photoCountLabel"),
                    t(locale, "dashboard.createdAt"),
                    t(locale, "dashboard.actions"),
                  ]}>
                    {selectedTeam.projects.map((project) => (
                      <tr key={project.projectID} className="hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium">{project.projectName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{project.addressInfo?.address || t(locale, "dashboard.noAddress")}</td>
                        <td className="px-4 py-3">{project.memberCount}</td>
                        <td className="px-4 py-3">{project.photoCount}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(project.createdAt, locale)}</td>
                        <td className="px-4 py-3">
                          <Button variant="outline" size="sm" onClick={() => setView({ type: "project", teamID: selectedTeam.groupID, projectID: project.projectID })}>
                            {t(locale, "dashboard.view")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                  {selectedTeam.projects.length === 0 && <EmptyState>{t(locale, "dashboard.noProjects")}</EmptyState>}
                </>
              )}

              {view.tab === "members" && (
                <>
                  {canManageTeam(selectedTeam, isSuperAdmin) && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        inviteTeamMember(selectedTeam)
                      }}
                      className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <UserPlus className="size-4 shrink-0 text-muted-foreground" />
                        <Input
                          type="email"
                          value={inviteEmail}
                          onChange={(event) => setInviteEmail(event.target.value)}
                          placeholder={t(locale, "dashboard.addMemberEmailPlaceholder")}
                          disabled={memberActionLoading === "invite"}
                        />
                      </div>
                      <Button type="submit" disabled={!inviteEmail.trim() || memberActionLoading === "invite"}>
                        <UserPlus className="size-4" />
                        {memberActionLoading === "invite" ? t(locale, "dashboard.addingMember") : t(locale, "dashboard.addMember")}
                      </Button>
                    </form>
                  )}
                  <DataTable columns={[
                    t(locale, "dashboard.member"),
                    t(locale, "dashboard.email"),
                    t(locale, "dashboard.role"),
                    t(locale, "dashboard.joinedAt"),
                    t(locale, "dashboard.actions"),
                  ]}>
                    {selectedTeam.members.map((member) => (
                      <tr key={member.userID} className="hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium">{member.userName || member.email}</td>
                        <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                        <td className="px-4 py-3">{roleNameFromID(member.roleID, locale)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(member.joinedAt, locale)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setView({ type: "member", teamID: selectedTeam.groupID, userID: member.userID })}>
                              {t(locale, "dashboard.view")}
                            </Button>
                            {canManageTeam(selectedTeam, isSuperAdmin) && member.userID !== user.id && member.roleID !== 1 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteTeamMember(selectedTeam, member)}
                                disabled={memberActionLoading === member.userID}
                              >
                                <Trash2 className="size-4" />
                                {memberActionLoading === member.userID ? t(locale, "dashboard.deleting") : t(locale, "dashboard.delete")}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                  {selectedTeam.members.length === 0 && <EmptyState>{t(locale, "dashboard.noMembers")}</EmptyState>}
                </>
              )}
            </div>
          )}

          {!loading && activeMenu === "teams" && view.type === "teamPhotos" && selectedTeam && (
            <div className="space-y-4">
              <Button variant="ghost" onClick={() => setView({ type: "team", teamID: selectedTeam.groupID, tab: "projects" })}>
                <ArrowLeft className="size-4" />
                {t(locale, "dashboard.backTeamDetail")}
              </Button>

              <Card className="rounded-lg">
                <CardHeader className="gap-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Camera className="size-5" />
                        {t(locale, "web.teamPhoto")}
                      </CardTitle>
                      <CardDescription>
                        {selectedTeam.groupName} · {t(locale, "web.photoCount", { count: teamPhotos[photoCacheKey(selectedTeam.groupID)]?.totalCount ?? selectedTeam.photoNum })}
                      </CardDescription>
                    </div>
                    <PhotoSelectionToolbar
                      locale={locale}
                      disabled={!teamPhotos[photoCacheKey(selectedTeam.groupID)] || photosLoading}
                      selectionMode={selectionMode}
                      selectedCount={selectedPhotoIDs.size}
                      downloading={downloadingZip}
                      onSelect={() => selectAllPhotos(photoCacheKey(selectedTeam.groupID))}
                      onSelectAll={() => selectAllPhotos(photoCacheKey(selectedTeam.groupID))}
                      onInvert={() => invertPhotoSelection(photoCacheKey(selectedTeam.groupID))}
                      onClear={clearTeamPhotoSelection}
                      onDownload={() => downloadSelectedPhotos({ team: selectedTeam })}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {selectionMode && <PhotoSelectionHint locale={locale} count={selectedPhotoIDs.size} />}
                  <PhotoDayGrid
                    locale={locale}
                    payload={teamPhotos[photoCacheKey(selectedTeam.groupID)]}
                    loading={photosLoading}
                    emptyText={t(locale, "dashboard.noPhotosPlain")}
                    onOpenPhoto={setActivePhoto}
                    selectionEnabled={selectionMode}
                    selectedPhotoIDs={selectedPhotoIDs}
                    onTogglePhoto={togglePhotoSelection}
                  />
                  <PhotoPagination
                    locale={locale}
                    payload={teamPhotos[photoCacheKey(selectedTeam.groupID)]}
                    loading={photosLoading}
                    onPageChange={(page) => changePhotoPage(selectedTeam.groupID, page)}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {!loading && activeMenu === "teams" && view.type === "project" && selectedTeam && selectedProject && (
            <div className="space-y-4">
              <Button variant="ghost" onClick={() => setView({ type: "team", teamID: selectedTeam.groupID, tab: "projects" })}>
                <ArrowLeft className="size-4" />
                {t(locale, "dashboard.backTeamDetail")}
              </Button>
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle className="text-lg">{selectedProject.projectName}</CardTitle>
                  <CardDescription>{selectedTeam.groupName}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatItem icon={<Users className="size-4" />} label={t(locale, "dashboard.memberCountLabel")} value={selectedProject.memberCount} />
                  <StatItem icon={<Camera className="size-4" />} label={t(locale, "dashboard.photoCountLabel")} value={selectedProject.photoCount} />
                  <StatItem icon={<FolderKanban className="size-4" />} label={t(locale, "dashboard.createdAt")} value={formatDate(selectedProject.createdAt, locale)} />
                  <StatItem icon={<MapPin className="size-4" />} label={t(locale, "dashboard.address")} value={selectedProject.addressInfo?.address || t(locale, "dashboard.noAddress")} />
                </CardContent>
              </Card>
              <Card className="rounded-lg">
                <CardHeader className="gap-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Camera className="size-5" />
                        {t(locale, "dashboard.projectPhotos")}
                      </CardTitle>
                      <CardDescription>{selectedProject.projectName} · {t(locale, "web.photoCount", { count: selectedProject.photoCount })}</CardDescription>
                    </div>
                    <PhotoSelectionToolbar
                      locale={locale}
                      disabled={!teamPhotos[photoCacheKey(selectedTeam.groupID, { projectID: selectedProject.projectID })] || photosLoading}
                      selectionMode={selectionMode}
                      selectedCount={selectedPhotoIDs.size}
                      downloading={downloadingZip}
                      onSelect={() => selectAllPhotos(photoCacheKey(selectedTeam.groupID, { projectID: selectedProject.projectID }))}
                      onSelectAll={() => selectAllPhotos(photoCacheKey(selectedTeam.groupID, { projectID: selectedProject.projectID }))}
                      onInvert={() => invertPhotoSelection(photoCacheKey(selectedTeam.groupID, { projectID: selectedProject.projectID }))}
                      onClear={clearTeamPhotoSelection}
                      onDownload={() => downloadSelectedPhotos({ team: selectedTeam, projectID: selectedProject.projectID })}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {selectionMode && <PhotoSelectionHint locale={locale} count={selectedPhotoIDs.size} />}
                  <PhotoDayGrid
                    locale={locale}
                    payload={teamPhotos[photoCacheKey(selectedTeam.groupID, { projectID: selectedProject.projectID })]}
                    loading={photosLoading}
                    emptyText={t(locale, "dashboard.noProjectPhotos")}
                    onOpenPhoto={setActivePhoto}
                    selectionEnabled={selectionMode}
                    selectedPhotoIDs={selectedPhotoIDs}
                    onTogglePhoto={togglePhotoSelection}
                  />
                  <PhotoPagination
                    locale={locale}
                    payload={teamPhotos[photoCacheKey(selectedTeam.groupID, { projectID: selectedProject.projectID })]}
                    loading={photosLoading}
                    onPageChange={(page) => changePhotoPage(selectedTeam.groupID, page, { projectID: selectedProject.projectID })}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {!loading && activeMenu === "teams" && view.type === "member" && selectedTeam && selectedMember && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                onClick={() =>
                  canManageTeam(selectedTeam, isSuperAdmin)
                    ? setView({ type: "team", teamID: selectedTeam.groupID, tab: "members" })
                    : setView({ type: "teams" })
                }
              >
                <ArrowLeft className="size-4" />
                {canManageTeam(selectedTeam, isSuperAdmin) ? t(locale, "dashboard.backTeamDetail") : t(locale, "dashboard.backTeamList")}
              </Button>
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle className="text-lg">{selectedMember.userName || selectedMember.email}</CardTitle>
                  <CardDescription>{selectedTeam.groupName}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatItem icon={<Users className="size-4" />} label={t(locale, "dashboard.memberName")} value={selectedMember.userName || t(locale, "dashboard.notSet")} />
                  <StatItem icon={<Mail className="size-4" />} label={t(locale, "dashboard.email")} value={selectedMember.email} />
                  <StatItem icon={<Settings className="size-4" />} label={t(locale, "dashboard.role")} value={roleNameFromID(selectedMember.roleID, locale)} />
                  <StatItem icon={<FolderKanban className="size-4" />} label={t(locale, "dashboard.joinedAt")} value={formatDate(selectedMember.joinedAt, locale)} />
                </CardContent>
              </Card>
              <Card className="rounded-lg">
                <CardHeader className="gap-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Camera className="size-5" />
                        {t(locale, "dashboard.memberPhotos")}
                      </CardTitle>
                      <CardDescription>{t(locale, "dashboard.memberPhotosDesc", { member: selectedMember.userName || selectedMember.email, team: selectedTeam.groupName })}</CardDescription>
                    </div>
                    <PhotoSelectionToolbar
                      locale={locale}
                      disabled={!teamPhotos[photoCacheKey(selectedTeam.groupID, { userID: selectedMember.userID })] || photosLoading}
                      selectionMode={selectionMode}
                      selectedCount={selectedPhotoIDs.size}
                      downloading={downloadingZip}
                      onSelect={() => selectAllPhotos(photoCacheKey(selectedTeam.groupID, { userID: selectedMember.userID }))}
                      onSelectAll={() => selectAllPhotos(photoCacheKey(selectedTeam.groupID, { userID: selectedMember.userID }))}
                      onInvert={() => invertPhotoSelection(photoCacheKey(selectedTeam.groupID, { userID: selectedMember.userID }))}
                      onClear={clearTeamPhotoSelection}
                      onDownload={() => downloadSelectedPhotos({ team: selectedTeam, userID: selectedMember.userID })}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {selectionMode && <PhotoSelectionHint locale={locale} count={selectedPhotoIDs.size} />}
                  <PhotoDayGrid
                    locale={locale}
                    payload={teamPhotos[photoCacheKey(selectedTeam.groupID, { userID: selectedMember.userID })]}
                    loading={photosLoading}
                    emptyText={t(locale, "dashboard.noMemberPhotos")}
                    onOpenPhoto={setActivePhoto}
                    selectionEnabled={selectionMode}
                    selectedPhotoIDs={selectedPhotoIDs}
                    onTogglePhoto={togglePhotoSelection}
                  />
                  <PhotoPagination
                    locale={locale}
                    payload={teamPhotos[photoCacheKey(selectedTeam.groupID, { userID: selectedMember.userID })]}
                    loading={photosLoading}
                    onPageChange={(page) => changePhotoPage(selectedTeam.groupID, page, { userID: selectedMember.userID })}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {!loading && overview && activeMenu === "settings" && (
            <div className="max-w-3xl space-y-4">
              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle className="text-lg">{t(locale, "dashboard.settings")}</CardTitle>
                  <CardDescription>{t(locale, "dashboard.currentAccount")}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <StatItem icon={<Mail className="size-4" />} label={t(locale, "dashboard.email")} value={overview.currentUser.email} />
                  <StatItem icon={<Users className="size-4" />} label={t(locale, "dashboard.username")} value={overview.currentUser.userName || t(locale, "dashboard.notSet")} />
                </CardContent>
              </Card>
            </div>
          )}
        </main>

        {activePhoto && (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
            <div className="flex h-16 shrink-0 items-center justify-between px-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActivePhoto(null)}
                className="border-white/20 bg-white text-black hover:bg-white/90"
              >
                {t(locale, "web.close")}
              </Button>
              <a
                href={activePhoto.downloadURL}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-black transition hover:bg-white/90"
              >
                <Download className="size-4" />
                {t(locale, "web.download")}
              </a>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
              {activePhoto.imageURL ? (
                <img
                  src={activePhoto.imageURL}
                  alt={activePhoto.localPhotoName || activePhoto.location || t(locale, "web.teamPhoto")}
                  className="max-h-full max-w-full rounded-lg object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-white/60">
                  <ImageOff className="size-12" />
                  <span>{t(locale, "web.largeImage")}</span>
                </div>
              )}
            </div>
            <div className="shrink-0 px-4 pb-5 text-center text-sm text-white/60">
              {[activePhoto.timeText, activePhoto.location, activePhoto.userName, activePhoto.projectName].filter(Boolean).join(" · ")}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
