import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { prisma } from "@/lib/prisma";
import { readFilters, readSelection, dateKey } from "@/lib/workspace/model";
import { accessFor, photoWhere, workspaceUser, workspaceFailure, WorkspaceError } from "@/lib/workspace/server";
import { sourceFile, safeName, downloadHeaders } from "@/lib/workspace/files";
import { readPublicRequest } from "@/lib/web/request";
import { photoWorkbook } from "@/lib/web/excel-photos";
import { exportGalleryURL } from "@/lib/web/gallery-url";

export const runtime = "nodejs";
export const maxDuration = 300;
const MAX_FILES = 200, MAX_BYTES = 100 * 1024 * 1024;
let activeDownloads = 0;

// Direct ZIP and Excel downloads share authentication, selection and rate limits.
export async function POST(req: Request) {
  let claimed = false;
  try {
    const user = await workspaceUser(req);
    if (activeDownloads >= 2) throw new WorkspaceError("DOWNLOAD_BUSY", 429);
    activeDownloads++; claimed = true;
    const body = await readPublicRequest(req);
    const format = body.format ?? "zip";
    if (format !== "zip" && format !== "xlsx") throw new WorkspaceError("INVALID_REQUEST");
    const access = await accessFor(typeof body.groupID === "string" ? body.groupID : "", user.id);
    if (!body.filters || typeof body.filters !== "object" || Array.isArray(body.filters) ||
        Object.values(body.filters).some(v => typeof v !== "string")) throw new WorkspaceError("INVALID_FILTER");
    const filters = readFilters(new URLSearchParams(body.filters as Record<string, string>));
    const selection = readSelection(body.selection);
    const photos = await prisma.photo.findMany({
      where: photoWhere(access, filters, selection),
      select: { photoID: true, timestamp: true, smallURL: true, largeURL: true, localPhotoName: true,
        takePhotoTimezoneID: true, location: true, lat: true, lng: true, mediaType: true,
        userName: true, userID: true, projectName: true, project: { select: { projectName: true } },
        user: { select: { userName: true } } },
      orderBy: [{ timestamp: "desc" }, { photoID: "desc" }], take: MAX_FILES + 1,
    });
    if (photos.length > MAX_FILES) throw new WorkspaceError("DIRECT_EXPORT_LIMIT");
    if (!photos.length) throw new WorkspaceError("NO_PHOTOS");
    if ((body.expectedCount !== undefined && body.expectedCount !== photos.length) ||
        (selection.mode === "ids" && selection.ids.length !== photos.length)) throw new WorkspaceError("SCOPE_CHANGED", 409);
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : access.team.groupName;
    const recheckAccess = async () => {
      const latestAccess = await accessFor(access.team.groupID, user.id);
      const count = await prisma.photo.count({ where: { AND: [photoWhere(latestAccess), { photoID: { in: photos.map(p => p.photoID) } }] } });
      if (count !== photos.length) throw new WorkspaceError("SCOPE_CHANGED", 409);
    };
    if (format === "xlsx") {
      const signal = AbortSignal.any([req.signal, AbortSignal.timeout(240000)]);
      const locale = typeof body.locale === "string" ? body.locale : "";
      const scope = filters.projectID ? { kind: "project" as const, id: filters.projectID }
        : filters.userID ? { kind: "user" as const, id: filters.userID }
        : { kind: "team" as const, id: access.team.groupID };
      const book = await photoWorkbook({
        photos: photos.map(photo => ({ ...photo, projectName: photo.project?.projectName || photo.projectName,
          userName: photo.userName || photo.user.userName })),
        galleryURL: exportGalleryURL(scope, locale), locale, signal,
      });
      signal.throwIfAborted();
      const data = await book.xlsx.writeBuffer();
      await recheckAccess();
      signal.throwIfAborted();
      return new Response(new Uint8Array(data), {
        headers: { ...downloadHeaders(`${title}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
          "Content-Length": String(data.byteLength) },
      });
    }
    const groupBy = body.groupBy ?? "date";
    if (typeof groupBy !== "string" || !["date", "project", "member"].includes(groupBy)) throw new WorkspaceError("INVALID_REQUEST");
    const controller = new AbortController();
    const signal = AbortSignal.any([req.signal, controller.signal, AbortSignal.timeout(240000)]);
    const archive = new ZipArchive({ store: true });
    const chunks: Buffer[] = [];
    let bytes = 0, sourceBytes = 0;
    const completed = new Promise<Buffer>((resolve, reject) => {
      archive.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES + 2 * 1024 * 1024) {
          controller.abort(); archive.abort(); reject(new WorkspaceError("DIRECT_EXPORT_SIZE_LIMIT"));
        } else chunks.push(chunk);
      });
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
      archive.on("warning", reject);
    });
    void completed.catch(() => {});
    try {
      for (const [index, photo] of photos.entries()) {
        signal.throwIfAborted();
        const source = await sourceFile(photo.largeURL || photo.smallURL, signal);
        const parts: Buffer[] = [];
        for await (const chunk of source.stream) {
          const part = Buffer.from(chunk); sourceBytes += part.length;
          if (sourceBytes > MAX_BYTES) {
            source.stream.destroy(); throw new WorkspaceError("DIRECT_EXPORT_SIZE_LIMIT");
          }
          parts.push(part);
        }
        const folder = groupBy === "member" ? photo.userName || photo.user.userName || photo.userID
          : groupBy === "project" ? photo.project?.projectName || photo.projectName || "No project"
          : dateKey(Number(photo.timestamp), filters.tz);
        const filename = safeName(photo.localPhotoName || photo.photoID + source.extension);
        archive.append(Buffer.concat(parts), { name: `${safeName(folder)}/${String(index + 1).padStart(4, "0")}_${filename}` });
      }
      await archive.finalize();
      const data = await completed;
      signal.throwIfAborted();
      await recheckAccess();
      return new Response(Readable.toWeb(Readable.from([data])) as ReadableStream, {
        headers: { ...downloadHeaders(`${title}.zip`, "application/zip"), "Content-Length": String(data.length) },
      });
    } finally {
      controller.abort(); archive.abort();
    }
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError")
      return workspaceFailure(new WorkspaceError("EXPORT_TIMEOUT", 504));
    if (e instanceof WorkspaceError || (e instanceof Error &&
      (/^INVALID_/.test(e.message) || ["FILE_UNAVAILABLE", "STORAGE_NOT_CONFIGURED"].includes(e.message))))
      return workspaceFailure(e);
    console.error("[workspace/direct-export]", e instanceof Error ? e.name : "failure");
    return workspaceFailure(new WorkspaceError("EXPORT_FAILED", 502));
  } finally {
    if (claimed) activeDownloads--;
  }
}
