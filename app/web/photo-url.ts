export function resolvePhotoURL(value: string | null | undefined) {
  if (!value) return null
  if (/^(https?:|data:|blob:)/i.test(value)) return value
  const baseURL = process.env.COS_PUBLIC_BASE_URL || ""
  if (!baseURL) return value.startsWith("/") ? value : `/${value}`
  return `${baseURL.replace(/\/$/, "")}/${value.replace(/^\//, "")}`
}
