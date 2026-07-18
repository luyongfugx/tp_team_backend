"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { clientLocale, t } from "@/lib/i18n"

type Auth = {
  token: string
  user?: { id: string; email: string }
}

type DuplicatePhoto = {
  photoID: string
  keep: boolean
  thumbnailURL: string | null
  largeURL: string | null
  ossFileName: string
  mediaID: string | null
  localPhotoName: string | null
  userID: string
  userName: string | null
  projectName: string | null
  location: string | null
  takePhotoFormatTime: string
  createdAt: string
}

type DuplicateGroup = {
  fingerprint: string
  label: string
  keepPhotoID: string
  duplicateCount: number
  photos: DuplicatePhoto[]
}

type FeedResult = {
  feedID: string
  groupID: string
  groupName: string
  projectID: number | null
  projectName: string | null
  photoCount: number
  duplicateGroups: DuplicateGroup[]
}

function readAuth() {
  try {
    const raw = window.localStorage.getItem("auth")
    return raw ? JSON.parse(raw) as Auth : null
  } catch {
    return null
  }
}

function shortID(value: string) {
  if (value.length <= 14) return value
  return `${value.slice(0, 7)}...${value.slice(-6)}`
}

async function readError(res: Response, locale: string) {
  try {
    const data = await res.json()
    return typeof data.error === "string" ? data.error : t(locale, "dedupe.requestFailed")
  } catch {
    return t(locale, "dedupe.requestFailed")
  }
}

export function FeedDedupeTool() {
  const [locale, setLocale] = useState("zh-Hans")
  const [auth, setAuth] = useState<Auth | null>(null)
  const [feedID, setFeedID] = useState("")
  const [feed, setFeed] = useState<FeedResult | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [deletingPhotoID, setDeletingPhotoID] = useState("")

  useEffect(() => {
    setLocale(clientLocale())
    setAuth(readAuth())
  }, [])

  async function queryFeed(nextFeedID = feedID) {
    setError("")
    setMessage("")
    setLoading(true)
    try {
      if (!auth?.token) {
        setError(t(locale, "dedupe.loginFirst"))
        return
      }
      const res = await fetch("/api/admin/feed-duplicates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
          "x-locale": locale,
        },
        body: JSON.stringify({ feedID: nextFeedID.trim() }),
      })
      if (!res.ok) {
        setError(await readError(res, locale))
        setFeed(null)
        return
      }
      const data = await res.json()
      setFeed(data.feed)
      setMessage(data.feed?.duplicateGroups?.length ? t(locale, "dedupe.foundDuplicates") : t(locale, "dedupe.noDuplicatesInFeed"))
    } catch {
      setError(t(locale, "common.networkError"))
    } finally {
      setLoading(false)
    }
  }

  async function deletePhoto(photoID: string) {
    if (!auth?.token || !feed) return
    if (!window.confirm(t(locale, "dedupe.confirmDelete", { photoID }))) return
    setError("")
    setMessage("")
    setDeletingPhotoID(photoID)
    try {
      const res = await fetch("/api/admin/feed-duplicates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
          "x-locale": locale,
        },
        body: JSON.stringify({ action: "delete", feedID: feed.feedID, photoID }),
      })
      if (!res.ok) {
        setError(await readError(res, locale))
        return
      }
      const data = await res.json()
      setFeed(data.feed)
      setMessage(t(locale, "dedupe.deletedPhoto", { photoID }))
    } catch {
      setError(t(locale, "common.networkError"))
    } finally {
      setDeletingPhotoID("")
    }
  }

  return (
    <main className="min-h-svh bg-background p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t(locale, "dedupe.toolLabel")}</p>
          <h1 className="text-2xl font-semibold tracking-normal">{t(locale, "dedupe.title")}</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t(locale, "dedupe.queryTitle")}</CardTitle>
            <CardDescription>{t(locale, "dedupe.queryDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3 md:flex-row md:items-end"
              onSubmit={(event) => {
                event.preventDefault()
                queryFeed()
              }}
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="feedID">feedID</Label>
                <Input
                  id="feedID"
                  value={feedID}
                  onChange={(event) => setFeedID(event.target.value)}
                  placeholder="cmretyh13000sp30kijwehsyy"
                />
              </div>
              <Button type="submit" disabled={loading || !feedID.trim()}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                {t(locale, "dedupe.query")}
              </Button>
            </form>
            {!auth?.token && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {t(locale, "dedupe.noToken")}
              </div>
            )}
            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="size-4" />
                {error}
              </div>
            )}
            {message && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" />
                {message}
              </div>
            )}
          </CardContent>
        </Card>

        {feed && (
          <Card>
            <CardHeader>
              <CardTitle>{feed.groupName}</CardTitle>
              <CardDescription>
                feedID: {feed.feedID} · groupID: {feed.groupID}
                {feed.projectName ? ` · ${t(locale, "dedupe.project")}: ${feed.projectName}` : ""} · {t(locale, "dedupe.photoCount")}: {feed.photoCount}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {feed.duplicateGroups.length === 0 ? (
                <div className="rounded-lg border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                  {t(locale, "dedupe.noDuplicatePhotos")}
                </div>
              ) : (
                feed.duplicateGroups.map((group) => (
                  <div key={group.fingerprint} className="rounded-lg border p-4">
                    <div className="mb-4 flex flex-col gap-1">
                      <div className="text-sm font-medium">{t(locale, "dedupe.groupSummary", { count: group.duplicateCount })}</div>
                      <div className="break-all text-xs text-muted-foreground">{group.label}</div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.photos.map((photo) => (
                        <div key={photo.photoID} className="overflow-hidden rounded-lg border bg-card">
                          <div className="aspect-[4/3] bg-muted">
                            {photo.thumbnailURL ? (
                              <img src={photo.thumbnailURL} alt={photo.localPhotoName || photo.photoID} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t(locale, "dedupe.noThumbnail")}</div>
                            )}
                          </div>
                          <div className="space-y-2 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs" title={photo.photoID}>{shortID(photo.photoID)}</span>
                              {photo.keep ? (
                                <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs text-emerald-700">{t(locale, "dedupe.keep")}</span>
                              ) : (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  disabled={Boolean(deletingPhotoID)}
                                  onClick={() => deletePhoto(photo.photoID)}
                                >
                                  {deletingPhotoID === photo.photoID ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                                  {t(locale, "dedupe.delete")}
                                </Button>
                              )}
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div>{t(locale, "dedupe.takenAt")}：{photo.takePhotoFormatTime}</div>
                              <div>{t(locale, "dedupe.user")}：{photo.userName || photo.userID}</div>
                              <div className="truncate" title={photo.ossFileName}>{t(locale, "dedupe.file")}：{photo.ossFileName}</div>
                              {photo.mediaID && <div className="truncate" title={photo.mediaID}>mediaID：{photo.mediaID}</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
