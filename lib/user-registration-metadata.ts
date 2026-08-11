import { prisma } from "@/lib/prisma"

const metadataSpecs = [
  { field: "appVersion", keys: ["App-Version", "appVersion", "app_version"] },
  { field: "versionCode", keys: ["versionCode", "version_code"] },
  { field: "platform", keys: ["platform"] },
  { field: "deviceId", keys: ["device_id", "deviceId"] },
  { field: "appUUID", keys: ["App-UUID", "appUUID", "appUuid", "app_uuid"] },
  { field: "deviceModel", keys: ["device model", "deviceModel", "device_model"] },
  { field: "realTimeZone", keys: ["realTimeZone", "real_time_zone"] },
  { field: "systemTimeZone", keys: ["systemTimeZone", "system_time_zone"] },
  { field: "countryCode", keys: ["countryCode", "country_code"] },
  { field: "appLan", keys: ["appLan", "app_lan", "language"] },
  { field: "fullapplan", keys: ["fullapplan", "fullAppLan", "full_app_lan"] },
] as const

type MetadataField = (typeof metadataSpecs)[number]["field"]
type MetadataValues = Partial<Record<MetadataField, string>>
type UserMetadataRecord = { id: string } & Partial<Record<MetadataField, string | null>>

function readString(body: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = body[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return undefined
}

export function userRegistrationMetadataFromBody(body: Record<string, unknown>): MetadataValues {
  const values: MetadataValues = {}
  for (const spec of metadataSpecs) {
    const value = readString(body, spec.keys)
    if (value) values[spec.field] = value
  }

  if (!values.appUUID && values.deviceId) values.appUUID = values.deviceId
  if (!values.fullapplan && values.appLan) values.fullapplan = values.appLan

  return values
}

export function hasUserRegistrationMetadata(values: MetadataValues) {
  return Object.keys(values).length > 0
}

export function missingUserRegistrationMetadata(user: UserMetadataRecord, values: MetadataValues) {
  const data: MetadataValues = {}
  for (const spec of metadataSpecs) {
    const field = spec.field
    if (values[field] && !user[field]) data[field] = values[field]
  }
  return data
}

export async function fillMissingUserRegistrationMetadata<T extends UserMetadataRecord>(
  user: T,
  body: Record<string, unknown>,
): Promise<T> {
  const values = userRegistrationMetadataFromBody(body)
  if (!hasUserRegistrationMetadata(values)) return user

  const data = missingUserRegistrationMetadata(user, values)
  if (!hasUserRegistrationMetadata(data)) return user

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: data as never,
  })
  return updated as unknown as T
}
