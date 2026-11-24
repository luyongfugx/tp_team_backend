import test from "node:test"
import assert from "node:assert/strict"
import { createVerificationVisitTracker, verificationPage, verificationPageParameters, verificationAnalyticsConfig } from "../lib/verification-analytics"
import { reportRequests, fetchReport, dailyRows, type ReportResult } from "./verification-analytics-report"

const code = "AB12CD34EF56", second = "ZY98XW76VU54", task = "12345678-1234-4123-8123-123456789abc"
test("only final functional routes count, preserving the /r entry after its rewrite", () => {
  for (const [path, page] of [[`/r/${code}`, "share_record"], [`/record/${code}`, "photo_record"], [`/verify/${task}`, "verification_report"]]) {
    assert.equal(verificationPage(path), page)
    for (const embed of [false, true]) {
      const result = verificationPageParameters(path, `?embed=${embed ? 1 : 0}&email=private@example.com&lat=22.67&token=secret`)
      assert.equal(result?.page_location, `https://h5.timeprint.net/_analytics/${page}/${embed ? "embedded" : "browser"}`)
      assert.equal(result?.page_referrer, "")
      assert.ok(!/AB12|12345678|private|22.67|secret|\?/.test(JSON.stringify(result)))
    }
  }
  for (const path of ["/", "/record", "/r", "/s/" + code, "/verification-preview", "/verification-example", "/api/photoCode/record", "/record/x/extra"]) assert.equal(verificationPage(path), null)
  assert.equal(verificationPage("/record/invalid"), "photo_record")
})
test("rerenders/query/hash changes do not count; different photos and return visits do", () => {
  const tracker = createVerificationVisitTracker()
  assert.ok(tracker.visit(`/r/${code}`, "?lang=en"))
  assert.equal(tracker.visit(`/r/${code}`, "?lang=ar&theme=dark"), null)
  assert.equal(tracker.visit(`/r/${code}/`, ""), null)
  assert.ok(tracker.visit(`/r/${second}`, ""))
  assert.ok(tracker.visit(`/r/${code}`, ""))
  assert.equal(tracker.visit("/verification-example", ""), null)
  assert.ok(tracker.visit(`/r/${code}`, ""))
  tracker.leave()
  assert.ok(tracker.visit(`/r/${code}`, ""))
})
test("configuration fails closed and cannot reuse the ordinary site's stream", () => {
  const valid = { VERIFICATION_ANALYTICS_ENABLED: "1", VERIFICATION_ANALYTICS_MEASUREMENT_ID: "G-TEST000001", VERIFICATION_ANALYTICS_STREAM_ID: "123456", VERIFICATION_ANALYTICS_ENHANCED_MEASUREMENT_DISABLED: "1" }
  assert.ok(verificationAnalyticsConfig(valid))
  for (const key of Object.keys(valid)) assert.equal(verificationAnalyticsConfig({ ...valid, [key]: "" }), null)
  for (const measurementId of ["G-Z9HJ16FDTS", "bad", "G-X&secret"]) assert.equal(verificationAnalyticsConfig({ ...valid, VERIFICATION_ANALYTICS_MEASUREMENT_ID: measurementId }), null)
  assert.equal(verificationAnalyticsConfig({ ...valid, NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: valid.VERIFICATION_ANALYTICS_MEASUREMENT_ID }), null)
})
test("GA requests independently deduplicate categories, union, contexts and period", () => {
  const requests = reportRequests("2026-11-24", "2026-11-25", "123456")
  assert.deepEqual(requests.share_record.dimensions, [{ name: "date" }])
  assert.deepEqual(requests.all.dimensions, [{ name: "date" }])
  assert.deepEqual(requests.period.dimensions, [])
  assert.deepEqual(requests.detail.dimensions, [{ name: "date" }, { name: "pagePath" }])
  assert.match(JSON.stringify(requests.all), /screenPageViews/)
  assert.match(JSON.stringify(requests.all), /totalUsers/)
  assert.throws(() => reportRequests("2026-02-31", "2026-11-25", "123456"))
  assert.throws(() => reportRequests("2026-11-24", "2026-11-25", "15325751892"))
})
const row = (day: string, uv = 1, pv = 1) => ({ dimensionValues: [{ value: day }], metricValues: [{ value: String(uv) }, { value: String(pv) }] })
const response = (rows: ReturnType<typeof row>[], rowCount = rows.length) => ({ dimensionHeaders: [{ name: "date" }], metricHeaders: [{ name: "totalUsers" }, { name: "screenPageViews" }], rows, rowCount, metadata: { timeZone: "Etc/GMT-8" } })
test("pagination must finish and stable rowCount is checked", async () => {
  let count = 0
  const request = reportRequests("2026-11-24", "2026-11-25", "123456").all
  const result = await fetchReport(request, "fake", async (_url, options) => {
    assert.equal(JSON.parse(String(options?.body)).offset, count)
    return new Response(JSON.stringify(response([row(count++ ? "20261125" : "20261124")], 2)))
  })
  assert.equal(result.complete, true); assert.equal(result.rows.length, 2)
  const incomplete = await fetchReport(request, "fake", async () => new Response(JSON.stringify(response([], 2))))
  assert.equal(incomplete.complete, false)
  const denied = await fetchReport(request, "secret-never-store", async () => new Response("secret-never-store", { status: 403 }))
  assert.equal(denied.complete, false); assert.ok(!JSON.stringify(denied).includes("secret-never-store"))
})
function good(rows: ReturnType<typeof row>[] = []): ReportResult {
  return { complete: true, rows, evidence: [{ requestedAt: "2026-11-27T00:00:00Z", request: {}, http: 200, rowCount: rows.length, metadata: { timeZone: "Etc/GMT-8" } }] }
}
test("unknown/historical/partial days are not zero; union UV is never a sum", () => {
  const results = Object.fromEntries(["share_record", "photo_record", "verification_report", "all"].map(key => [key, good([row("20261125", 1, key === "all" ? 3 : 1)])]))
  const coverage = { streamId: "123456", collectionStartedAt: "2026-11-24T17:00:00+08:00", verifiedDateRanges: [{ start: "2026-11-25", end: "2026-11-26" }] }
  const report = dailyRows("2026-11-23", "2026-11-27", results, coverage, new Date("2026-11-27T12:00:00+08:00"))
  assert.equal(report[0].status, "未采集"); assert.equal(report[0].all.uv, null)
  assert.match(report[1].status, /非完整日/); assert.equal(report[1].all.uv, null)
  assert.equal(report[2].all.uv, 1); assert.equal(report[2].all.pv, 3)
  assert.equal(report[3].all.uv, 0); assert.match(report[3].status, /GA 已观测 0/)
  assert.equal(report[4].status, "未结束"); assert.equal(report[4].all.uv, null)
  results.all.evidence[0].metadata!.subjectToThresholding = true
  assert.equal(dailyRows("2026-11-26", "2026-11-26", results, coverage, new Date("2026-11-27"))[0].all.uv, null)
  results.all.complete = false
  assert.match(dailyRows("2026-11-26", "2026-11-26", results, coverage, new Date("2026-11-27"))[0].status, /未知/)
})
