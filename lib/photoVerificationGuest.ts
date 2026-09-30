import { createHash } from "node:crypto"

// Random per-client verification credential. Store only its hash; never return it in task responses.
export function verificationGuestKey(value: unknown): string | null {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return null
  return createHash("sha256").update(value.toLowerCase()).digest("hex")
}

export function verificationOwner(userID: string | null, guestToken: unknown) {
  if (userID) return { userID }
  const guestKey = verificationGuestKey(guestToken)
  return guestKey ? { userID: null, guestKey } : null
}
