import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { stripTypeScriptTypes } from "node:module"
import { randomUUID } from "node:crypto"
import { validateVerificationImageURL } from "../lib/photoVerification.ts"

// Execute the route handlers with isolated DB/OCR dependencies; no network or database.
function handler(path, dependencies = {}) {
  const source = readFileSync(new URL(`../app/api/${path}/route.ts`, import.meta.url), "utf8")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["']\s*;?\s*$/gm, "")
    .replace(/export\s+(?=async function|const)/g, "")
  const deps = {
    randomUUID,
    NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
    ok: body => ({ status: 200, body }),
    bad: (message, status = 400) => ({ status, message }),
    badFor: (_req, message, status = 400) => ({ status, message }),
    serverError: () => ({ status: 500 }),
    readBody: req => req.json(),
    requireUser: async () => null,
    publicVerificationTask: value => value,
    initialVerificationProgress: () => ({}),
    failedVerificationProgress: () => ({}),
    submitPhotoVerificationTask: async () => {},
    validateVerificationImageURL,
    ...dependencies,
  }
  return new Function(...Object.keys(deps), stripTypeScriptTypes(source) + "\nreturn POST;")(...Object.values(deps))
}
const request = body => new Request("https://example.com/api", { method: "POST", body: JSON.stringify(body) })
process.env.TENCENT_COS_BUCKETS_JSON = JSON.stringify({verify_images:{bucket:"test-123",region:"ap-singapore"}})
const imageUrl = "https://test-123.cos.ap-singapore.myqcloud.com/verify/guest-123/image.jpg"

test("anonymous creation stores a nullable owner and submits OCR", async () => {
  let task; let submitted = false
  const POST = handler("photoCode/verify/task", {
    prisma: {photoVerificationTask: {
      create: async ({data}) => (task = data),
      updateMany: async () => ({count:1}),
      findUnique: async () => task,
    }},
    submitPhotoVerificationTask: async () => { submitted = true },
  })
  const result = await POST(request({imageUrl}))
  assert.equal(result.status, 200)
  assert.equal(task.userID, null)
  assert.ok(submitted)
  assert.match(task.taskID, /^[0-9a-f-]{36}$/)
})

test("status and timeout work without a session, scoped to the supplied task ID", async () => {
  for (const endpoint of ["status", "timeout"]) {
    const taskID = randomUUID()
    let update
    const POST = handler(`photoCode/verify/task/${endpoint}`, {
      prisma: {photoVerificationTask: {
        findFirst: async ({where}) => { assert.deepEqual(where,{taskID}); return {taskID,status:"PROCESSING"} },
        updateMany: async query => { update = query; return {count:1} },
      }},
    })
    assert.equal((await POST(request({taskID}))).status, 200)
    if (endpoint === "timeout") assert.deepEqual(update.where,{taskID,status:{in:["PENDING","PROCESSING"]}})
    assert.equal((await POST(request({taskID:""}))).status, 400)
  }
})

test("missing tasks remain 404", async () => {
  const POST = handler("photoCode/verify/task/status",{prisma:{photoVerificationTask:{findFirst:async()=>null}}})
  assert.equal((await POST(request({taskID:randomUUID()}))).status,404)
})

test("anonymous photo record lookup skips account-specific enrichment", async () => {
  const record = {photoCode:"ABEFIJKMNOPR"}
  const POST = handler("photoCode/record",{
    fetchTrustedPhotoRecord: async code => { assert.equal(code,record.photoCode); return record },
    enrichCaptureTeamInfo: () => { throw new Error("Should not enrich anonymous records") },
  })
  assert.deepEqual((await POST(request({photoCode:record.photoCode}))).body,record)
})

test("anonymous upload validates JPEG and uses a random guest namespace", async () => {
  let key
  const POST = handler("photoCode/verify/upload",{uploadVerificationImage: async path => {key=path;return imageUrl}})
  const form = new FormData();form.set("image",new File([new Uint8Array([255,216,255,1])],"test.jpg"))
  assert.equal((await POST(new Request("https://example.com",{method:"POST",body:form}))).status,200)
  assert.match(key,/^verify\/guest-[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/)
  const invalid = new FormData();invalid.set("image",new File(["invalid"],"test.jpg"))
  assert.equal((await POST(new Request("https://example.com",{method:"POST",body:invalid}))).status,400)
})

test("public verification still rejects unsafe image sources", () => {
  assert.ok(validateVerificationImageURL(imageUrl))
  assert.ok(validateVerificationImageURL(imageUrl.replace("guest-123","existing-user")))
  for (const url of [imageUrl.replace("https:","http:"),imageUrl.replace("test-123.cos.ap-singapore.myqcloud.com","example.com"),imageUrl+"?x=1",imageUrl.replace("/verify/","/private/"),imageUrl.replace("image.jpg","image.png"),imageUrl.replace("guest-123","a%2f..%2fb"),imageUrl.replace("guest-123/","")]) {
    assert.equal(validateVerificationImageURL(url),null,url)
  }
})
