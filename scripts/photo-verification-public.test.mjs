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

test("creation waits for OCR acceptance but performs no redundant DB round trips", async () => {
  let accept
  let submitted = false
  const acknowledgement = new Promise(resolve => { accept = resolve })
  const POST = handler("photoCode/verify/task", {
    prisma: {photoVerificationTask: {
      create: async ({data}) => data,
      updateMany: async () => { throw new Error("Unexpected database update") },
      findUnique: async () => { throw new Error("Unexpected database read") },
    }},
    submitPhotoVerificationTask: async () => { submitted = true; await acknowledgement },
  })
  let completed = false
  const response = POST(request({imageUrl})).then(value => { completed = true; return value })
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(submitted)
  assert.equal(completed, false)
  accept()
  assert.equal((await response).body.status, "PENDING")
})

test("submission failure cannot overwrite a task already advanced by OCR callback", async () => {
  for (const status of ["PENDING", "PROCESSING", "SUCCEEDED"]) {
    let task
    const POST = handler("photoCode/verify/task", {
      prisma: {photoVerificationTask: {
        create: async ({data}) => { task = {...data}; return {...data} },
        updateMany: async ({where, data}) => {
          assert.equal(where.status, "PENDING")
          if (task.status !== where.status) return {count: 0}
          task = {...task, ...data}; return {count: 1}
        },
        findUnique: async () => task,
      }},
      submitPhotoVerificationTask: async () => { task.status = status; throw new Error("acknowledgement lost") },
    })
    const result = await POST(request({imageUrl}))
    assert.equal(result.body.status, status === "PENDING" ? "FAILED" : status)
  }
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

function photoRecordEnricher(prisma) {
  const source = readFileSync(new URL('../lib/photoRecord.ts', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/export\s+(?=async function)/g, '')
  return new Function('prisma', stripTypeScriptTypes(source) + '\nreturn enrichCaptureTeamInfo;')(prisma)
}

test('guest enrichment preserves OCR results without querying account photos', async () => {
  const enrich = photoRecordEnricher({ photo: {
    findFirst: () => assert.fail('Guest must not query photos'),
    findMany: () => assert.fail('Guest must not query photos'),
  } })
  const result = { photoCode: { recognized: '9ZIOXF9IMYZN' }, captureRecord: { mediaID: 'media', timestamp: 1790750000000 } }
  for (const owner of [null, undefined, '', '  ']) {
    assert.equal(await enrich(result, owner), result)
  }
})

test('signed-in enrichment retains the account filter', async () => {
  const enrich = photoRecordEnricher({ photo: {
    findFirst: async ({where}) => {
      assert.deepEqual(where, { userID: 'user-123', antiFakeCode: '9ZIOXF9IMYZN', deletedAt: null })
      return {groupID:'group', projectID:'project', projectName:'Project', team:{groupName:'Team'}}
    },
  } })
  const result = await enrich({photoCode:'9ZIOXF9IMYZN', captureRecord:{}}, 'user-123')
  assert.equal(result.captureRecord.groupName, 'Team')
  assert.equal(result.captureRecord.projectName, 'Project')
})

test('guest success callbacks persist both passing and non-passing OCR results', async () => {
  for (const verified of [true, false]) {
    let update
    const prisma = {
      photo: { findFirst: () => assert.fail('Guest must not query account photos') },
      photoVerificationTask: {
        findUnique: async () => ({taskID:'task', userID:null, status:'PROCESSING'}),
        updateMany: async query => { update = query; return {count:1} },
      },
    }
    const POST = handler('photoCode/verify/task/callback', {
      prisma,
      callbackSecretMatches: value => value === 'test-secret',
      enrichCaptureTeamInfo: photoRecordEnricher(prisma),
      completedVerificationProgress: () => ({complete:true}),
      normalizeVerificationErrorCode: value => String(value),
    })
    const result = {verified, photoCode:{recognized:'9ZIOXF9IMYZN'}, captureRecord:{timestamp:1790750000000}}
    if (!verified) result.errorCode = '409'
    const req = request({taskId:'task', status:'SUCCEEDED', result})
    req.headers.set('x-callback-secret', 'test-secret')
    assert.equal((await POST(req)).status, 200)
    assert.equal(update.data.status, 'SUCCEEDED')
    assert.equal(update.data.verified, verified)
    assert.deepEqual(update.data.result, result)
    assert.equal(update.data.errorCode, verified ? null : '409')
    assert.equal((await POST(request({taskId:'task', status:'SUCCEEDED', result}))).status, 401)
  }
})
