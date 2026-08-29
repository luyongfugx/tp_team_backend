"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, FileJson, Image as ImageIcon, Loader2, ShieldCheck, XCircle, X } from "lucide-react"
import { authenticatedFetch } from "@/lib/client-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Outcome = "all" | "success" | "failure"

type Task = {
  taskID: string
  userID: string
  status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED"
  photoCode: string | null
  verified: boolean | null
  errorCode: string | null
  errorMessage: string | null
  verificationProgress: unknown
  createdAt: string
  completedAt: string | null
  user: { id: string; email: string; userName: string | null; shortName: string | null }
}

type JSONDocument = { objectKey: string | null; document: Record<string, unknown> | null; error: string | null }
type Detail = {
  task: Task & { result: Record<string, unknown> | null; imageObjectKey: string; resultObjectKey: string | null }
  image: { objectKey: string; url: string | null; error: string | null }
  sourceJSON: JSONDocument
  verifyJSON: JSONDocument
  analysis: {
    passed: boolean
    summary: string
    errorCode: string | null
    errorMessage: string | null
    failedStages: string[]
    mismatches: Array<{ field: string; reason: string; detail?: unknown }>
  }
}

type Payload = {
  tasks: Task[]
  pagination: { page: number; pageSize: number; totalCount: number; totalPages: number }
}

function isChinese(locale: string) {
  return locale.toLowerCase().startsWith("zh")
}

function statusLabel(task: Task, chinese: boolean) {
  if (task.verified === true) return chinese ? "通过" : "Passed"
  if (task.status === "FAILED" || task.verified === false) return chinese ? "失败" : "Failed"
  if (task.status === "PROCESSING") return chinese ? "处理中" : "Processing"
  return chinese ? "等待中" : "Pending"
}

function JSONViewer({ value, error }: { value: Record<string, unknown> | null; error: string | null }) {
  if (error) return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
  if (!value) return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No JSON document</div>
  return <pre className="max-h-[62vh] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">{JSON.stringify(value, null, 2)}</pre>
}

export function PhotoVerificationRecords({ token, locale, refreshKey = 0 }: { token: string; locale: string; refreshKey?: number }) {
  const chinese = isChinese(locale)
  const [outcome, setOutcome] = useState<Outcome>("all")
  const [page, setPage] = useState(1)
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [tab, setTab] = useState<"analysis" | "image" | "source" | "verify">("analysis")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const url = new URL("/api/admin/photo-verifications", window.location.origin)
      url.searchParams.set("outcome", outcome)
      url.searchParams.set("page", String(page))
      url.searchParams.set("pageSize", "30")
      const response = await authenticatedFetch(url.toString(), token, { headers: { "x-locale": locale } })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Request failed")
      setPayload(data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed")
    } finally {
      setLoading(false)
    }
  }, [locale, outcome, page, refreshKey, token])

  useEffect(() => { load() }, [load])

  async function openDetail(taskID: string) {
    setDetailLoading(true)
    setError("")
    setTab("analysis")
    try {
      const response = await authenticatedFetch(`/api/admin/photo-verifications/${encodeURIComponent(taskID)}`, token, {
        headers: { "x-locale": locale },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Request failed")
      setDetail(data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed")
    } finally {
      setDetailLoading(false)
    }
  }

  const filters: Array<{ value: Outcome; label: string }> = [
    { value: "all", label: chinese ? "全部" : "All" },
    { value: "success", label: chinese ? "验真成功" : "Passed" },
    { value: "failure", label: chinese ? "验真失败" : "Failed" },
  ]

  return (
    <div className="space-y-4">
      <Card className="rounded-lg">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="size-5" />{chinese ? "用户验真记录" : "Photo verification records"}</CardTitle>
            <CardDescription>{chinese ? "查看全部用户的验真结果和 COS 原始文件，分析失败原因。" : "Review user verification results, COS artifacts, and failure diagnostics."}</CardDescription>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>{loading && <Loader2 className="size-4 animate-spin" />}{chinese ? "刷新" : "Refresh"}</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <Button
                key={filter.value}
                variant={outcome === filter.value ? "default" : "outline"}
                onClick={() => { setOutcome(filter.value); setPage(1) }}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          {loading && !payload ? <div className="p-8 text-center text-muted-foreground"><Loader2 className="mx-auto size-6 animate-spin" /></div> : (
            <div className="overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr>
                    <th className="px-4 py-3">{chinese ? "提交时间" : "Submitted"}</th>
                    <th className="px-4 py-3">{chinese ? "用户" : "User"}</th>
                    <th className="px-4 py-3">PhotoCode</th>
                    <th className="px-4 py-3">{chinese ? "状态" : "Status"}</th>
                    <th className="px-4 py-3">{chinese ? "错误" : "Error"}</th>
                    <th className="px-4 py-3">{chinese ? "操作" : "Action"}</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {(payload?.tasks || []).map((task) => {
                      const passed = task.verified === true
                      const failed = task.status === "FAILED" || task.verified === false
                      return <tr key={task.taskID} className="hover:bg-muted/40">
                        <td className="px-4 py-3 text-muted-foreground">{new Date(task.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3"><div className="font-medium">{task.user.userName || task.user.shortName || task.user.email}</div><div className="text-xs text-muted-foreground">{task.user.email}</div></td>
                        <td className="px-4 py-3 font-mono">{task.photoCode || "-"}</td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${passed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : failed ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>{passed ? <CheckCircle2 className="size-3.5" /> : failed ? <XCircle className="size-3.5" /> : <Loader2 className="size-3.5 animate-spin" />}{statusLabel(task, chinese)}</span></td>
                        <td className="max-w-[280px] truncate px-4 py-3 text-muted-foreground">{[task.errorCode, task.errorMessage].filter(Boolean).join(" · ") || "-"}</td>
                        <td className="px-4 py-3"><Button size="sm" variant="outline" disabled={detailLoading} onClick={() => openDetail(task.taskID)}>{chinese ? "查看详情" : "Details"}</Button></td>
                      </tr>
                    })}
                  </tbody>
                </table>
              </div>
              {!loading && !payload?.tasks.length && <div className="p-8 text-center text-sm text-muted-foreground">{chinese ? "暂无验真记录" : "No verification records"}</div>}
            </div>
          )}
          {payload && <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{chinese ? `共 ${payload.pagination.totalCount} 条` : `${payload.pagination.totalCount} records`}</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>{chinese ? "上一页" : "Previous"}</Button><span>{page} / {payload.pagination.totalPages}</span><Button size="sm" variant="outline" disabled={page >= payload.pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}>{chinese ? "下一页" : "Next"}</Button></div></div>}
        </CardContent>
      </Card>

      {(detail || detailLoading) && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 md:p-8" onMouseDown={(event) => { if (event.target === event.currentTarget && !detailLoading) setDetail(null) }}>
        <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b p-4 md:p-5"><div><h2 className="text-lg font-semibold">{chinese ? "验真记录详情" : "Verification detail"}</h2><p className="mt-1 font-mono text-xs text-muted-foreground">{detail?.task.taskID}</p></div><Button size="icon" variant="ghost" onClick={() => setDetail(null)} disabled={detailLoading}><X className="size-5" /></Button></div>
          {detailLoading ? <div className="flex min-h-80 items-center justify-center"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div> : detail && <>
            <div className="flex flex-wrap gap-2 border-b p-3">
              {([
                ["analysis", chinese ? "失败分析" : "Analysis", AlertTriangle],
                ["image", chinese ? "验真图片" : "Image", ImageIcon],
                ["source", "photocode.json", FileJson],
                ["verify", "verify.json", FileJson],
              ] as const).map(([value, label, Icon]) => <Button key={value} size="sm" variant={tab === value ? "default" : "outline"} onClick={() => setTab(value)}><Icon className="size-4" />{label}</Button>)}
            </div>
            <div className="overflow-auto p-4 md:p-6">
              {tab === "analysis" && <div className="space-y-4">
                <div className={`rounded-xl border p-4 ${detail.analysis.passed ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"}`}><div className="flex items-center gap-2 font-semibold">{detail.analysis.passed ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}{detail.analysis.summary}</div>{detail.analysis.errorCode && <div className="mt-2 text-sm">{detail.analysis.errorCode} · {detail.analysis.errorMessage}</div>}</div>
                <div className="grid gap-3 md:grid-cols-3"><div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">PhotoCode</div><div className="mt-1 font-mono">{detail.task.photoCode || "-"}</div></div><div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{chinese ? "用户" : "User"}</div><div className="mt-1">{detail.task.user.email}</div></div><div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{chinese ? "失败阶段" : "Failed stages"}</div><div className="mt-1">{detail.analysis.failedStages.join(", ") || "-"}</div></div></div>
                {detail.analysis.mismatches.map((item) => <div key={item.field} className="rounded-lg border border-red-200 p-4 dark:border-red-900"><div className="font-medium text-red-700 dark:text-red-300">{item.field}</div><div className="mt-1 text-sm text-muted-foreground">{item.reason}</div>{item.detail != null && <details className="mt-3"><summary className="cursor-pointer text-sm">{chinese ? "查看诊断数据" : "Diagnostic data"}</summary><pre className="mt-2 max-h-72 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(item.detail, null, 2)}</pre></details>}</div>)}
              </div>}
              {tab === "image" && (detail.image.url ? <div className="flex min-h-[50vh] items-center justify-center rounded-lg bg-black/95 p-3"><img src={detail.image.url} alt="Verification upload" className="max-h-[68vh] max-w-full object-contain" /></div> : <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">{detail.image.error || "Image unavailable"}</div>)}
              {tab === "source" && <><div className="mb-2 font-mono text-xs text-muted-foreground">{detail.sourceJSON.objectKey}</div><JSONViewer value={detail.sourceJSON.document} error={detail.sourceJSON.error} /></>}
              {tab === "verify" && <><div className="mb-2 font-mono text-xs text-muted-foreground">{detail.verifyJSON.objectKey}</div><JSONViewer value={detail.verifyJSON.document || detail.task.result} error={detail.verifyJSON.document || detail.task.result ? null : detail.verifyJSON.error} /></>}
            </div>
          </>}
        </div>
      </div>}
    </div>
  )
}
