type ZaloTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: string | number
  error?: number | string
  error_name?: string
  message?: string
}

type ZaloPicture = {
  data?: {
    url?: string
  }
}

export type ZaloProfile = {
  id: string
  name?: string
  picture?: ZaloPicture | string
  error?: number | string
  message?: string
}

function zaloAppID() {
  return process.env.ZALO_APP_ID || process.env.NEXT_PUBLIC_ZALO_APP_ID || ""
}

function zaloAppSecret() {
  return process.env.ZALO_APP_SECRET || process.env.ZALO_SECRET_KEY || ""
}

function allowedRedirectUris() {
  return (process.env.ZALO_REDIRECT_URIS || process.env.ZALO_REDIRECT_URI || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function assertZaloRedirectUri(redirectUri?: string) {
  if (!redirectUri) return
  const allowed = allowedRedirectUris()
  if (allowed.length > 0 && !allowed.includes(redirectUri)) {
    throw new Error("Zalo redirectUri 不在允许列表")
  }
}

export function zaloAvatar(profile: ZaloProfile) {
  if (typeof profile.picture === "string") return profile.picture
  return profile.picture?.data?.url
}

function zaloTokenError(data: ZaloTokenResponse) {
  return data.message || data.error_name || (data.error != null ? `Zalo token error: ${data.error}` : "Zalo token 获取失败")
}

export async function exchangeZaloCodeForToken({
  code,
  codeVerifier,
}: {
  code: string
  codeVerifier: string
}) {
  const appID = zaloAppID()
  const appSecret = zaloAppSecret()
  if (!appID) throw new Error("Zalo 登录未配置 ZALO_APP_ID")
  if (!appSecret) throw new Error("Zalo 登录未配置 ZALO_APP_SECRET")

  const body = new URLSearchParams()
  body.set("app_id", appID)
  body.set("grant_type", "authorization_code")
  body.set("code", code)
  body.set("code_verifier", codeVerifier)

  const res = await fetch("https://oauth.zaloapp.com/v4/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: appSecret,
    },
    body,
  })
  const data = (await res.json().catch(() => ({}))) as ZaloTokenResponse
  if (!res.ok || !data.access_token) {
    throw new Error(zaloTokenError(data))
  }
  return data
}

export async function fetchZaloProfile(accessToken: string) {
  const url = new URL("https://graph.zalo.me/v2.0/me")
  url.searchParams.set("fields", "id,name,picture")
  const res = await fetch(url.toString(), {
    headers: { access_token: accessToken },
  })
  const data = (await res.json().catch(() => ({}))) as ZaloProfile
  if (!res.ok || !data.id) {
    throw new Error(data.message || "Zalo 用户资料获取失败")
  }
  return data
}
