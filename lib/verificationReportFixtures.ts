import { photoRecordReport, unavailableReport, verificationReport } from "./verificationReport"
// Demonstration data, always labelled as a sample. Only the fixed mismatch example
// is public; the full state matrix requires an explicitly enabled development route.
export function verificationReportFixture(state: string) {
  const code = "AB12CD34EF56"
  const captureRecord = { photoCode: code, captureTime: "2026-11-02 10:32:40", timestamp: 1793586760000,
    address: "1 First Street NE, Washington, DC 20543, United States", latlng: "38.8977,-77.0365",
    timezoneAbbreviation: "UTC−05:00", timezoneID: "America/New_York", deviceModel: "iPhone 11", os: "iOS 26", appVersion: "4.2.9", captureSource: "Timeprint", locationAccuracyMeters: 8 }
  if (state === "record") return photoRecordReport({ captureRecord }, code)
  if (state === "not_found" || state === "error") return unavailableReport("record", state)
  const result = { verified: true, photoCode: { recognized: code, matched: true },
    time: { verified: true, expected: "2026-11-02 10:32:40", regions: [{ recognized: "2026-11-02 10:32" }] },
    address: { verified: true, expected: captureRecord.address, regions: [{ recognized: captureRecord.address }] },
    content: { verified: true, supported: true, reason: "match" }, captureRecord }
  const task: Record<string, unknown> = { taskID: "12345678-1234-4123-8123-123456789abc", status: "SUCCEEDED", result, verified: true, completedAt: 1793586800000 }
  if (state === "mismatch") {
    result.verified = false; task.verified = false; task.errorCode = "412"
    result.time = { verified: false, expected: "2026-11-02 10:32:40", regions: [{ recognized: "2026-11-02 11:32" }] }
  } else if (state === "partial") {
    result.verified = false; task.verified = false; result.content = { verified: false, supported: false, reason: "unsupported" }
  } else if (state === "unavailable") { task.result = {}; task.verified = false; task.errorCode = "424" }
  else if (state === "unsupported") { task.result = { source: { status: "unsupported", confirmed: true } }; task.verified = false }
  else if (state === "processing") task.status = "PROCESSING"
  const report = verificationReport(task); report.imageUrl = "/verification-preview/sample"; return report
}
