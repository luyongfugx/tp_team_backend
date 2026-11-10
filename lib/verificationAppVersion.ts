// Historical capture JSON stored the build number as versionCode. These pairs
// come from the clients' release configuration history, not decimal splitting.
// Android: gradle/libs.versions.toml (e.g. 6406ed1c3, 97efdb4a7).
// iOS: iOSTimeGPS.xcodeproj/project.pbxproj (e.g. 235c457d, 7d323098).
const androidReleases: Record<string, readonly number[]> = {
  "4.0.2": [4021, 4027], "4.0.3": [4031, 4033], "4.0.4": [4041, 4049],
  "4.0.5": [4051], "4.0.6": [4061], "4.0.7": [4071], "4.0.8": [4081, 4082],
  "4.0.9": [4091, 4092], "4.1.0": [4103], "4.1.1": [4111],
  "4.1.2": [4121, 4123, 4128], "4.1.3": [4131, 4132], "4.1.4": [4141],
  "4.1.5": [4151, 4152], "4.1.6": [4162, 4163, 4165, 4166], "4.2.0": [4201],
  "4.2.1": [4211, 4212], "4.2.3": [4231, 4233, 4235, 4236, 4237],
  "4.2.7": [4271, 4272, 4273], "4.2.8": [4281],
}
const iosReleases: Record<string, readonly number[]> = {
  "4.2.2": [43], "4.2.4": [46], "4.2.5": [48, 49],
  "4.2.6": [50], "4.2.7": [51], "4.2.8": [52],
}

function versionName(value: unknown) {
  if (typeof value !== "string") return ""
  const name = value.trim()
  return /^\d+\.\d+(?:\.\d+){0,2}$/.test(name) ? name : ""
}

export function captureAppVersion(record: Record<string, unknown>): string {
  // Prefer the captured release version, never the viewer's installed version.
  for (const value of [record.appVersion, record.versionName, record.versionCode]) {
    const name = versionName(value)
    if (name) return name
  }
  const os = typeof record.os === "string" ? record.os.trim() : ""
  const releases = /^android\b/i.test(os) ? androidReleases : /^ios\b/i.test(os) ? iosReleases : null
  if (!releases) return ""
  for (const raw of [record.versionCode, record.appVersion]) {
    const value = typeof raw === "number" || typeof raw === "string" ? String(raw).trim() : ""
    if (!/^\d+$/.test(value)) continue
    const build = Number(value)
    for (const [name, builds] of Object.entries(releases)) {
      if (builds.includes(build)) return name
    }
  }
  // Reused/unknown build numbers cannot establish a release version.
  return ""
}
