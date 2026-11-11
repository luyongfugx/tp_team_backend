import assert from "node:assert/strict"
import { test } from "node:test"
import { inspectionObjects, inspectionPolicy, createInspectionSTSHandler } from "../lib/inspection-sts"
import { readPublicRequest } from "../lib/web/request"
import type { CredentialData, GetCredentialOptions } from "qcloud-cos-sts"

const key = "samples/v1/live/baseline-v1/ios/iPhone17~2c1/en/ui-v1/ios.page.p000001/none/default.jpg"
const body = { bucketKey: "inspection", objectKey: key, access: "write" }
const env = { TENCENT_COS_SECRET_ID: "test-only-id", TENCENT_COS_SECRET_KEY: "test-only-key" }
const fake: CredentialData = { startTime: 100, expiredTime: 1000, requestId: "test",
  credentials: { tmpSecretId: "temporary-id", tmpSecretKey: "temporary-key", sessionToken: "session" } }
const request = () => new Request("https://test/api/workgroup/v4/oss/sts", { headers: { "x-real-ip": "192.0.2.1" } })

test("exact pair accepts live/audit, platform, locale and popup distinctions", () => {
  assert.deepEqual(inspectionObjects(key), [key, key.replace("samples/", "markers/").replace(/\.jpg$/, ".done")])
  assert.ok(inspectionObjects(key.replace("v1/live/", "v1/audit/sim-test/")))
  assert.ok(inspectionObjects(key.replaceAll("ios", "android").replace("/en/", "/ar/")))
  assert.ok(inspectionObjects(key.replace("/none/", "/ios.popup.d000001/")))
})
test("scope rejects wildcards, cross-platform IDs, traversal and unsupported states", () => {
  for (const value of [undefined, "", key.replace("iPhone17~2c1", "*"), key.replace("/en/", "/../"),
    key.replace("/en/", "/%2e%2e/"), key.replace("ios.page", "android.page"), key.replace(".jpg", ".done"),
    key.replace("samples/", "markers/"), key.replace("/default", "/typing"), key + "?x", key.replace("~2c", "~zz")]) {
    assert.equal(inspectionObjects(value), null, String(value))
  }
})
test("COS policy grants only two PutObjects, forces no-overwrite and empty marker", () => {
  const policy = inspectionPolicy(inspectionObjects(key)!)
  assert.equal(policy.statement.length, 2)
  for (const statement of policy.statement) {
    assert.deepEqual(statement.action, ["name/cos:PutObject"])
    assert.ok(!statement.resource.includes("*"))
    assert.equal(statement.condition.string_equal["cos:x-cos-forbid-overwrite"], "true")
  }
  assert.equal(policy.statement[0].condition.numeric_less_than_equal["cos:content-length"], 600000)
  assert.equal(policy.statement[1].condition.numeric_less_than_equal["cos:content-length"], 0)
})
test("anonymous request uses one 15-minute STS grant for the pair, no permanent keys returned", async () => {
  const issued: GetCredentialOptions[] = []
  const handle = createInspectionSTSHandler(async options => { issued.push(options); return fake }, env)
  const response = await handle(request(), body)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "no-store")
  const result = await response.json()
  assert.equal(result.credentials.sessionToken, "session")
  assert.equal(result.objectKey, key)
  assert.equal(result.bucket, "timeprint-inspection-1330977225")
  assert.equal(issued.length, 1)
  assert.equal(issued[0].durationSeconds, 900)
  assert.ok(!JSON.stringify(result).includes("test-only"))
})
test("read access, unrelated buckets and invalid scope never call issuer", async () => {
  let calls = 0
  const handle = createInspectionSTSHandler(async () => { calls++; return fake }, env)
  for (const invalid of [{ ...body, access: "read" }, { ...body, access: "readwrite" },
    { ...body, bucketKey: "team" }, { ...body, objectKey: "samples/*" }]) {
    assert.equal((await handle(request(), invalid)).status, 400)
  }
  assert.equal(calls, 0)
})
test("missing configuration and provider failure fail closed without exposing secrets", async () => {
  let calls = 0
  const missing = createInspectionSTSHandler(async () => { calls++; return fake }, {})
  assert.equal((await missing(request(), body)).status, 503)
  assert.equal(calls, 0)
  const broken = createInspectionSTSHandler(async () => { throw Error("private provider payload") }, env)
  const response = await broken(request(), body)
  assert.equal(response.status, 503)
  assert.ok(!(await response.text()).includes("private"))
})
test("rate limit bounds issuance and resets next minute", async () => {
  let now = 0, calls = 0
  const handle = createInspectionSTSHandler(async () => { calls++; return fake }, env, () => now)
  for (let i = 0; i < 120; i++) assert.equal((await handle(request(), body)).status, 200)
  assert.equal((await handle(request(), body)).status, 429)
  assert.equal(calls, 120)
  now = 60001
  assert.equal((await handle(request(), body)).status, 200)
})
test("concurrent STS requests are bounded and release slots after completion", async () => {
  const finish: ((value: CredentialData) => void)[] = []
  const handle = createInspectionSTSHandler(() => new Promise(resolve => finish.push(resolve)), env)
  const pending = Array.from({ length: 8 }, () => handle(request(), body))
  assert.equal((await handle(request(), body)).status, 429)
  finish.forEach(resolve => resolve(fake))
  assert.ok((await Promise.all(pending)).every(response => response.status === 200))
})
test("public body parsing rejects oversized and malformed payloads", async () => {
  const req = (text: string) => new Request("https://test", { method: "POST", body: text })
  assert.deepEqual(await readPublicRequest(req(JSON.stringify(body)), 4096), body)
  for (const text of ["[]", "null", "{", JSON.stringify({ value: "x".repeat(4096) })]) {
    await assert.rejects(readPublicRequest(req(text), 4096))
  }
})
