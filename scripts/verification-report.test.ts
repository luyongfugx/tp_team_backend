import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { stripTypeScriptTypes } from "node:module"
import { captureRecord, normalizePhotoCode, normalizeTaskID, verificationReport, photoRecordReport, unavailableReport, text } from "../lib/verificationReport"
import { verificationReportFixture } from "../lib/verificationReportFixtures"

test("a successful task cannot turn absent evidence into four passes", () => {
  const report = verificationReport({ status: "SUCCEEDED", verified: true, result: { verified: true } })
  assert.equal(report.state, "unavailable")
  assert.ok(report.checks.every(check => check.state === "unavailable"))
})
test("a report requires every necessary check, with incomplete evidence explicitly separated", () => {
  assert.equal(verificationReportFixture("passed").state, "passed")
  const partial = verificationReportFixture("partial")
  assert.equal(partial.state, "partial")
  assert.equal(partial.checks.find(c => c.key === "content")?.state, "not_checked")
  assert.equal(verificationReportFixture("unavailable").state, "unavailable")
})
test("readable contradictory time preserves the two values", () => {
  const report = verificationReportFixture("mismatch")
  assert.equal(report.state, "mismatch")
  const time = report.checks.find(c => c.key === "time")!
  assert.equal(time.state, "mismatch")
  assert.match(time.expected, /10:32/)
  assert.match(time.recognized, /11:32/)
})
test("OCR failure and absent references are not tampering", () => {
  const report = verificationReport({ status: "SUCCEEDED", errorCode: "412", result: {
    time: { verified: false, expected: "2026-11-02 10:32", regions: [{ recognized: "10?", reason: "complete_date_time_not_recognized" }] },
    content: { verified: false, reason: "reference_unavailable" },
  } })
  assert.equal(report.state, "unavailable")
  assert.equal(report.checks[1].state, "unavailable")
  assert.equal(report.checks[3].reason, "reference_missing")
})
test("service failure and unsupported source remain distinct from mismatch", () => {
  assert.equal(verificationReport({status:"FAILED", errorCode:"-2500"}).state, "error")
  assert.equal(verificationReport({status:"FAILED", errorCode:"403"}).state, "unavailable")
  assert.equal(verificationReportFixture("unsupported").state, "unsupported")
  assert.notEqual(verificationReport({status:"SUCCEEDED", result:{source:{status:"unsupported"}}}).state, "unsupported")
})
test("code lookup never exposes photo verification badges or account data", () => {
  const report = photoRecordReport({captureRecord: {captureTime:"2026-11-02",deviceID:"private", groupName:"Private team", userID:"private"}}, "AB12CD34EF56")
  assert.equal(report.state, "record"); assert.deepEqual(report.checks, [])
  assert.equal(report.imageUrl, null)
  assert.ok(!JSON.stringify(report).includes("private"))
  assert.equal(photoRecordReport({}, "AB12CD34EF56").state, "not_found")
  assert.equal(photoRecordReport({photoCode:"ZY98XW76VU54",captureRecord:{captureTime:"2026-11-02"}}, "AB12CD34EF56").state, "error")
})
test("an invalid recognized code cannot be displayed as verified", () => {
  const report = verificationReport({status:"SUCCEEDED",verified:true,result:{photoCode:{recognized:"ABC",matched:true}}})
  assert.equal(report.checks[0].state,"unavailable")
  assert.notEqual(report.state,"passed")
})
test("invalid coordinates are not replaced by Null Island; valid zero coordinates survive", () => {
  for (const latlng of [",", "0,", "x,0", "91,0", "0,181"]) assert.equal(captureRecord({latlng})?.latitude, null)
  assert.equal(captureRecord({latlng:"0,0"})?.latitude, 0)
  assert.equal(captureRecord({latlng:"22.67,114.11"})?.longitude, 114.11)
})
test("public report identifiers are UUIDv4 task capabilities and record codes are strict", () => {
  assert.equal(normalizeTaskID("12345678-1234-4123-8123-123456789ABC"), "12345678-1234-4123-8123-123456789abc")
  for (const id of ["1", "AB12CD34EF56", "../../etc", "12345678-1234-1123-8123-123456789abc"]) assert.equal(normalizeTaskID(id), null)
  assert.equal(normalizePhotoCode(" ab12cd34ef56 "), "AB12CD34EF56")
  assert.equal(normalizePhotoCode("AB12/CD34EF56"), null)
})

function loader(dependencies: Record<string, unknown>) {
  const source = readFileSync(new URL("../lib/publicVerificationReport.ts", import.meta.url), "utf8")
    .replace(/^import .*$/gm, "").replace(/export\s+(?=async function)/g, "")
  const deps = { normalizePhotoCode, normalizeTaskID, verificationReport, photoRecordReport, unavailableReport, text, ...dependencies }
  return new Function(...Object.keys(deps), stripTypeScriptTypes(source) + "\nreturn { getVerificationReport, getCaptureRecordReport };")(...Object.values(deps))
}
test("reports load the exact requested task even when a photo code has later results", async () => {
  const taskID = "12345678-1234-4123-8123-123456789abc"
  const service = loader({prisma:{photoVerificationTask:{
    findUnique: async ({where}: any) => { assert.deepEqual(where,{taskID}); return {taskID,status:"SUCCEEDED",result:{},imageObjectKey:"verify/guest/test.jpg"} },
    findFirst: () => assert.fail("A report must never choose the latest task by photo code"),
  }}, signedVerificationImageURL: () => "https://signed.example/image.jpg"})
  const result = await service.getVerificationReport(taskID)
  assert.equal(result.taskID, taskID); assert.equal(result.imageUrl, "https://signed.example/image.jpg")
})
test("code-only shares do not need any previous verification task", async () => {
  const service = loader({prisma:{photoVerificationTask:{findFirst:()=>assert.fail("No task query")}}, fetchTrustedPhotoRecord: async () => ({captureRecord:{captureTime:"2026-11-02"}})})
  assert.equal((await service.getCaptureRecordReport("AB12CD34EF56")).state, "record")
})
test("database/network failure is not presented as a missing or forged photo", async () => {
  const service = loader({prisma:{photoVerificationTask:{findUnique:()=>{throw Error("offline")}}}, fetchTrustedPhotoRecord:()=>{throw Error("offline")}})
  assert.equal((await service.getVerificationReport("12345678-1234-4123-8123-123456789abc")).state,"error")
  assert.equal((await service.getCaptureRecordReport("AB12CD34EF56")).state,"error")
})

test("record date/time preserves the capture timezone and does not invent missing values", async () => {
  const { captureDateAndTime } = await import("../lib/verificationReportTime")
  const record = captureRecord({ captureTime: "2026-09-30 15:34:35", timestamp: 1790753675515, timezoneID: "Asia/Shanghai" })
  assert.deepEqual(captureDateAndTime(record, "en-US"), { date: "2026-09-30", time: "15:34:35" })
  const utc = captureRecord({ timestamp: Date.UTC(2026, 10, 4, 0, 0, 0), timezoneID: "Asia/Shanghai" })
  assert.equal(captureDateAndTime(utc, "en-GB").time, "08:00:00")
  assert.deepEqual(captureDateAndTime(captureRecord({timestamp: 1790753675515}), "en"), { date: "—", time: "—" })
  assert.deepEqual(captureDateAndTime(null, "en"), { date: "—", time: "—" })
})
