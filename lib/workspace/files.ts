import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { resolvePhotoURL } from "@/app/web/photo-url";

export const exportRoot = () =>
  // Generated private files live on the runtime volume, never in the build bundle.
  path.resolve(/* turbopackIgnore: true */ process.env.WORKSPACE_EXPORT_DIR || ".data/workspace-exports");
export function safeName(value: string) {
  return (
    value
      .normalize("NFC")
      .replace(/[\x00-\x1f<>:"/\\|?*]/g, "_")
      .replace(/^\.+/, "")
      .trim()
      .slice(0, 90) || "photo"
  );
}
export function downloadHeaders(
  name: string,
  mime = "application/octet-stream",
) {
  return {
    "Content-Type": mime,
    "Content-Disposition": `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(safeName(name))}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
// Fetch only configured storage hosts. Redirects are validated again, never followed blindly.
export async function sourceFile(
  value: string | null,
  signal?: AbortSignal,
): Promise<{ stream: Readable; type: string; extension: string }> {
  const resolved = resolvePhotoURL(value);
  if (!resolved) throw new Error("FILE_UNAVAILABLE");
  // Repository-owned fixtures are local development only; arbitrary local files are never accepted.
  if (
    process.env.NODE_ENV !== "production" &&
    /^\/workspace-demo\/[a-zA-Z0-9_-]+\.(svg|jpg|png)$/.test(resolved)
  ) {
    const file = path.join(process.cwd(), "public", "workspace-demo", path.basename(resolved));
    await stat(file);
    return {
      stream: createReadStream(file, { signal }),
      type: resolved.endsWith(".svg") ? "image/svg+xml" : "image/jpeg",
      extension: path.extname(file),
    };
  }
  const configured = (process.env.WORKSPACE_MEDIA_HOSTS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (process.env.COS_PUBLIC_BASE_URL)
    configured.push(
      new URL(process.env.COS_PUBLIC_BASE_URL).hostname.toLowerCase(),
    );
  // Reuse the existing app's configured media buckets for older deployments.
  const addBucket = (bucket: unknown, region: unknown) => {
    if (
      typeof bucket === "string" &&
      typeof region === "string" &&
      /^[a-z0-9-]+$/.test(bucket) &&
      /^[a-z0-9-]+$/.test(region)
    ) {
      configured.push(
        `${bucket}.cos.${region}.myqcloud.com`,
        `${bucket}.cos.${region}.tencentcos.cn`,
      );
    }
  };
  if (process.env.TENCENT_COS_BUCKETS_JSON) {
    const buckets = JSON.parse(process.env.TENCENT_COS_BUCKETS_JSON);
    for (const key of ["team", "ios_app", "android_app"]) {
      const entry = buckets[key];
      if (entry && entry.allowRead !== false)
        addBucket(entry.bucket, entry.region);
    }
  } else
    addBucket(
      process.env.TENCENT_COS_TEAM_BUCKET,
      process.env.TENCENT_COS_REGION,
    );
  let url = new URL(resolved);
  for (let n = 0; n < 4; n++) {
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !configured.includes(url.hostname.toLowerCase())
    )
      throw new Error("STORAGE_NOT_CONFIGURED");
    const response = await fetch(url, {
      redirect: "manual",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
        : AbortSignal.timeout(60000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) throw new Error("FILE_UNAVAILABLE");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error("FILE_UNAVAILABLE");
    }
    const type = (
      response.headers.get("content-type") || "application/octet-stream"
    ).split(";")[0];
    const extension =
      (
        {
          "image/jpeg": ".jpg",
          "image/png": ".png",
          "image/heic": ".heic",
          "image/webp": ".webp",
          "video/mp4": ".mp4",
          "video/quicktime": ".mov",
        } as Record<string, string>
      )[type] || ".bin";
    return {
      stream: Readable.fromWeb(response.body as never),
      type,
      extension,
    };
  }
  throw new Error("FILE_UNAVAILABLE");
}
export function sizeLimit(maxBytes: number) {
  let size = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.length;
      callback(size > maxBytes ? new Error("FILE_TOO_LARGE") : null, chunk);
    },
  });
}
