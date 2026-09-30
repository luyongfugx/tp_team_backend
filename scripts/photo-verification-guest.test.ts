import assert from "node:assert/strict"
import { test } from "node:test"
import { verificationGuestKey, verificationOwner } from "../lib/photoVerificationGuest"
import { validateVerificationImageURL } from "../lib/photoVerification"

const guest = "caab00a1-4702-441e-839f-1e99c7dad2f0"
const other = "dcab00a1-4702-441e-839f-1e99c7dad2f0"
test("guest credentials are validated and hashed, with distinct owners", () => {
  for (const value of [undefined, null, "", "guest", {}, "a".repeat(10000)]) {
    assert.equal(verificationOwner(null, value), null)
  }
  const owner = verificationOwner(null, guest)!
  assert.equal(owner.userID, null)
  assert.notEqual(owner.guestKey, guest)
  assert.equal(owner.guestKey?.length, 64)
  assert.equal(verificationGuestKey(guest.toUpperCase()), owner.guestKey)
  assert.notDeepEqual(owner, verificationOwner(null, other))
})
test("account ownership never falls back to the supplied guest credential", () => {
  assert.deepEqual(verificationOwner("account-a", guest), { userID: "account-a" })
  assert.notDeepEqual(verificationOwner("account-a", guest), verificationOwner(null, guest))
  assert.notDeepEqual(verificationOwner("account-b", guest), verificationOwner("account-a", guest))
})
test("guests can only submit random guest upload paths in the allowed bucket", () => {
  process.env.TENCENT_COS_BUCKETS_JSON = JSON.stringify({verify_images:{bucket:"test",region:"ap-singapore"}})
  const host = "https://test.cos.ap-singapore.myqcloud.com/"
  const path = `verify/guest-${guest}/${other}.jpg`
  assert.ok(validateVerificationImageURL(host + path, null))
  assert.equal(validateVerificationImageURL(host + "verify/account-a/test.jpg", null), null)
  assert.equal(validateVerificationImageURL(host + path, "account-a"), null)
  assert.ok(validateVerificationImageURL(host + "verify/account-a/test.jpg", "account-a"))
  assert.equal(validateVerificationImageURL("https://evil.example/" + path, null), null)
  assert.equal(validateVerificationImageURL(host + path + "?foo=bar", null), null)
  assert.equal(validateVerificationImageURL(host + "verify/guest-invalid/test.jpg", null), null)
})
