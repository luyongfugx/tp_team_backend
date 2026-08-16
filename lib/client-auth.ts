export const AUTH_STORAGE_KEY = "auth"
export const SESSION_EXPIRED_EVENT = "timeprint-session-expired"

let handlingExpiredSession = false

export function resetExpiredSessionHandling() {
  handlingExpiredSession = false
}

export function clearStoredAuth() {
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {}
}

function handleExpiredSession() {
  if (typeof window === "undefined" || handlingExpiredSession) return
  handlingExpiredSession = true
  clearStoredAuth()
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  window.location.replace("/")
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  token: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${token}`)

  const response = await fetch(input, { ...init, headers })
  if (response.status === 401) handleExpiredSession()
  return response
}
