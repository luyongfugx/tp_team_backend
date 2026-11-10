import test from "node:test"
import assert from "node:assert/strict"
import { matchingReportImage, livePreviewImage } from "../lib/verificationPreviewImage"
const expected = "https://verification.cos.example/verify/guest-123/photo-123.jpg"
test("uses the signed preview of the exact task image and decodes HTML ampersands", () => {
  assert.equal(matchingReportImage(`<meta property="og:image" content="${expected}?signature=example&amp;expires=900"/>`, expected), `${expected}?signature=example&expires=900`)
  assert.equal(matchingReportImage(`<meta content='${expected}' property='og:image'/>`, expected), expected)
})
test("rejects unrelated images, unsafe protocols, credentials and malformed previews", () => {
  for (const url of ["https://unrelated.example/a.jpg",expected.replace("photo-123", "another-photo"),expected.replace("https:", "http:"),expected.replace("https://", "https://user:pass@"),"javascript:alert(1)"]) {
    assert.equal(matchingReportImage(`<meta property="og:image" content="${url}"/>`, expected), null)
  }
  assert.equal(matchingReportImage("no image", expected), null)
  assert.equal(matchingReportImage(`<meta property="og:image" content="${expected}"/>`, "invalid"), null)
})
test("the live preview adapter remains disabled outside development", async () => {
  const previous = process.env.NODE_ENV
  Object.assign(process.env, {NODE_ENV: "production"})
  try { assert.equal(await livePreviewImage("unused", expected), null) }
  finally { if(previous === undefined) Reflect.deleteProperty(process.env, "NODE_ENV"); else Object.assign(process.env, {NODE_ENV: previous}) }
})
