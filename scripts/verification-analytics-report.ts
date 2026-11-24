import { readFile, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"
import { VERIFICATION_PAGE_TITLES, type VerificationPage } from "../lib/verification-analytics"

export const PROPERTY_ID = "547150932"
const pages = Object.keys(VERIFICATION_PAGE_TITLES) as VerificationPage[]
const contexts = ["browser", "embedded"] as const
export const paths = pages.flatMap(page => contexts.map(context => `/_analytics/${page}/${context}`))
type Request = ReturnType<typeof reportRequests>[string]
type Row = { dimensionValues: { value: string }[]; metricValues: { value: string }[] }
type Metadata = { timeZone?: string; subjectToThresholding?: boolean; dataLossFromOtherRow?: boolean;
  samplingMetadatas?: unknown[]; schemaRestrictionResponse?: unknown; dataTruncationReasons?: unknown[]; emptyReason?: string }
type Response = { rows?: Row[]; rowCount?: number; metadata?: Metadata;
  dimensionHeaders?: { name: string }[]; metricHeaders?: { name: string }[] }
export type ReportResult = { complete: boolean; rows: Row[]; error?: string;
  evidence: { requestedAt: string; request: unknown; http: number; rowCount: number; metadata?: Metadata }[] }
export type Coverage = { streamId: string; collectionStartedAt: string | null;
  verifiedDateRanges: { start: string; end: string }[] }

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value
}
function exact(fieldName: string, value: string) {
  return { filter: { fieldName, stringFilter: { matchType: "EXACT", value, caseSensitive: true } } }
}
export function reportRequests(start: string, end: string, streamId: string) {
  if (!validDate(start) || !validDate(end) || start > end || !/^\d+$/.test(streamId)
    || streamId === "15325751892") throw new Error("Use valid dates and the final dedicated stream ID, not the old site stream.")
  function request(selected: string[], dimensions = ["date"]) {
    return {
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: dimensions.map(name => ({ name })),
      metrics: [{ name: "totalUsers" }, { name: "screenPageViews" }],
      dimensionFilter: { andGroup: { expressions: [exact("streamId", streamId), exact("hostName", "h5.timeprint.net"),
        exact("eventName", "page_view"), { filter: { fieldName: "pagePath", inListFilter: { values: selected, caseSensitive: true } } }] } },
      orderBys: dimensions.map(dimensionName => ({ dimension: { dimensionName } })),
      limit: 10000,
      returnPropertyQuota: true,
    }
  }
  const requests: Record<string, ReturnType<typeof request>> = {
    detail: request(paths, ["date", "pagePath"]),
    all: request(paths),
    // Across-date UV is independently deduplicated by GA too.
    period: request(paths, []),
  }
  for (const page of pages) requests[page] = request(paths.filter(path => path.startsWith(`/_analytics/${page}/`)))
  for (const context of contexts) requests[context] = request(paths.filter(path => path.endsWith(`/${context}`)))
  return requests
}

export async function fetchReport(body: Request, token: string, request: typeof fetch = fetch): Promise<ReportResult> {
  const result: ReportResult = { complete: false, rows: [], evidence: [] }
  let expected: number | undefined
  const seenRows = new Set<string>()
  try {
    for (let offset = 0; ; ) {
      const payload = { ...body, offset }
      const requestedAt = new Date().toISOString()
      const response = await request(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(30000), redirect: "error",
      })
      // Never store error bodies: only status and safe report fields, never auth material.
      if (!response.ok) {
        result.evidence.push({ requestedAt, request: payload, http: response.status, rowCount: 0 })
        throw new Error(`GA Data API HTTP ${response.status}`)
      }
      const data = await response.json() as Response
      const rowCount = data.rowCount ?? 0
      result.evidence.push({ requestedAt, request: payload, http: response.status, rowCount, metadata: data.metadata })
      if (JSON.stringify(data.dimensionHeaders?.map(h => h.name) ?? []) !== JSON.stringify(body.dimensions.map(d => d.name))
        || JSON.stringify(data.metricHeaders?.map(h => h.name)) !== JSON.stringify(body.metrics.map(m => m.name))) {
        throw new Error("GA returned unexpected report headers")
      }
      if (!Number.isSafeInteger(rowCount) || rowCount < 0 || (expected !== undefined && expected !== rowCount)) {
        throw new Error("GA rowCount changed during pagination; re-run the query")
      }
      expected = rowCount
      const rows = data.rows ?? []
      for (const row of rows) {
        if (row.dimensionValues?.length !== body.dimensions.length || row.metricValues?.length !== 2
          || row.metricValues.some(v => !/^\d+$/.test(v.value) || !Number.isSafeInteger(Number(v.value)))) {
          throw new Error("GA returned incomplete/invalid rows")
        }
        const key = JSON.stringify(row.dimensionValues)
        if (seenRows.has(key)) throw new Error("GA returned duplicate rows during pagination; re-run the query")
        seenRows.add(key)
        for (const [index, dimension] of body.dimensions.entries()) {
          const value = row.dimensionValues[index].value
          if (dimension.name === "date" && (!/^\d{8}$/.test(value)
            || value < body.dateRanges[0].startDate.replaceAll("-", "")
            || value > body.dateRanges[0].endDate.replaceAll("-", ""))) throw new Error("GA returned a date outside the requested range")
          if (dimension.name === "pagePath" && !paths.includes(value)) throw new Error("GA returned an unexpected page path")
        }
      }
      result.rows.push(...rows)
      offset += rows.length
      if (offset === rowCount) { result.complete = true; return result }
      if (!rows.length || offset > rowCount) throw new Error("GA returned incomplete pagination")
    }
  } catch (error) {
    // Do not include fetch errors' URLs/headers or the token in evidence.
    result.error = error instanceof Error && error.message.startsWith("GA ") ? error.message : "GA request failed or timed out"
    return result
  }
}

export function completeUnrestricted(result: ReportResult | undefined) {
  return Boolean(result?.complete && result.evidence.length && result.evidence.every(e => {
    const meta = e.metadata
    return meta && ["Etc/GMT-8", "Asia/Shanghai"].includes(meta.timeZone || "")
      && !meta.subjectToThresholding && !meta.dataLossFromOtherRow && !meta.samplingMetadatas?.length
      && !meta.schemaRestrictionResponse && !meta.dataTruncationReasons?.length && !meta.emptyReason
  }))
}
function beijingDate(value: Date) { return new Date(value.getTime() + 8 * 3600000).toISOString().slice(0, 10) }
export function dailyRows(start: string, end: string, results: Record<string, ReportResult>, coverage: Coverage, now = new Date()) {
  const today = beijingDate(now)
  const launch = coverage.collectionStartedAt ? beijingDate(new Date(coverage.collectionStartedAt)) : null
  const output = []
  for (let day = start; day <= end; day = new Date(Date.parse(day) + 86400000).toISOString().slice(0, 10)) {
    const verified = coverage.verifiedDateRanges.some(range => range.start <= day && range.end >= day)
    const required: (VerificationPage | "all")[] = [...pages, "all"]
    const healthy = required.every(key => completeUnrestricted(results[key]))
    let status = day >= today ? "未结束" : launch && day < launch ? "未采集"
      : !healthy ? "未知（查询失败、不完整或受限）" : !launch ? "未知（采集起点未确认）"
      : day === launch ? "上线当日（非完整日）" : !verified ? "未知（采集连续性未确认）" : "已采集（GA 数据可能延迟）"
    const canFillZero = day < today && Boolean(launch && day > launch) && verified && healthy
    const metrics = {} as Record<VerificationPage | "all", { uv: number | null; pv: number | null }>
    for (const key of required) {
      const result = results[key]
      const row = !(launch && day < launch) && result?.complete
        && result.rows.find(row => row.dimensionValues[0]?.value === day.replaceAll("-", ""))
      metrics[key] = {
        uv: row ? Number(row.metricValues[0].value) : canFillZero ? 0 : null,
        pv: row ? Number(row.metricValues[1].value) : canFillZero ? 0 : null,
      }
    }
    if (canFillZero && metrics.all.uv === 0 && metrics.all.pv === 0) status = "GA 已观测 0（数据可能延迟）"
    output.push({ date: day, status, ...metrics })
  }
  return output
}

async function main() {
  const { values } = parseArgs({ options: {
    start: { type: "string" }, end: { type: "string" }, "stream-id": { type: "string" },
    coverage: { type: "string" }, out: { type: "string" }, "dry-run": { type: "boolean" },
  } })
  const streamId = values["stream-id"] || process.env.VERIFICATION_ANALYTICS_STREAM_ID || ""
  const start = values.start || "", end = values.end || ""
  const requests = reportRequests(start, end, streamId)
  if (values["dry-run"]) { console.log(JSON.stringify({ propertyId: PROPERTY_ID, streamId, requests }, null, 2)); return }
  if (!process.env.GA_ACCESS_TOKEN) throw new Error("Inject an existing read-only OAuth token through GA_ACCESS_TOKEN; do not place credentials in arguments or files.")
  const coverage: Coverage = values.coverage ? JSON.parse(await readFile(values.coverage, "utf8"))
    : { streamId, collectionStartedAt: null, verifiedDateRanges: [] }
  if (coverage.streamId !== streamId || !Array.isArray(coverage.verifiedDateRanges)
    || (coverage.collectionStartedAt !== null && (typeof coverage.collectionStartedAt !== "string"
      || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(coverage.collectionStartedAt) || !Number.isFinite(Date.parse(coverage.collectionStartedAt))))
    || coverage.verifiedDateRanges.some(r => !validDate(r.start) || !validDate(r.end) || r.start > r.end)) {
    throw new Error("Coverage must refer to this stream with a timestamp including timezone and verified date ranges.")
  }
  const results: Record<string, ReportResult> = {}
  for (const [key, request] of Object.entries(requests)) results[key] = await fetchReport(request, process.env.GA_ACCESS_TOKEN)
  const report = { propertyId: PROPERTY_ID, streamId, fetchedAt: new Date().toISOString(), start, end,
    timezone: "Asia/Shanghai", coverage, daily: dailyRows(start, end, results, coverage), results }
  const json = JSON.stringify(report, null, 2) + "\n"
  if (values.out) await writeFile(values.out, json, { mode: 0o600 })
  else console.log(json)
  if (Object.values(results).some(result => !result.complete)) process.exitCode = 1
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : "Report failed"); process.exitCode = 1 })
}
