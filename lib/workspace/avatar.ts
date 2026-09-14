// Avatar uploads can be stored as a COS object key rather than a complete URL.
// Resolve them only for the web UI; retain the existing App/login response format.
export function workspaceAvatarURL(value: string | null | undefined): string | null {
  const source = value?.trim();
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) return source;
  if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(source)) return source;
  if (/^[a-z][a-z\d+.-]*:/i.test(source) || source.startsWith("//")) return null;
  const key = source.replace(/^\/+/, "");
  if (!key || key.includes("\\") || key.split("/").some(part => part === ".." || part === ".")) return null;
  if (!key.startsWith("teamspace/avatar/")) return source.startsWith("/") ? source : null;

  const customBase = process.env.COS_PUBLIC_BASE_URL?.trim();
  if (customBase && /^https?:\/\//i.test(customBase))
    return `${customBase.replace(/\/+$/, "")}/${key}`;
  let bucket = process.env.TENCENT_COS_TEAM_BUCKET?.trim();
  let region = process.env.TENCENT_COS_REGION?.trim();
  if (process.env.TENCENT_COS_BUCKETS_JSON) {
    try {
      const team = JSON.parse(process.env.TENCENT_COS_BUCKETS_JSON).team;
      if (typeof team?.bucket === "string" && typeof team?.region === "string") {
        bucket = team.bucket.trim();
        region = team.region.trim();
      }
    } catch { /* A malformed optional avatar configuration must not break the photo list. */ }
  }
  if (!bucket || !region || !/^[a-z0-9-]+$/.test(bucket) || !/^[a-z0-9-]+$/.test(region)) return null;
  return `https://${bucket}.cos.${region}.myqcloud.com/${key}`;
}
