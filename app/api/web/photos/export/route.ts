import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { formatDateTime, photoTimeZone } from "@/app/web/photos-data";
import { resolveLocale } from "@/lib/i18n";
import { ZipArchive } from "archiver";
import { prisma } from "@/lib/prisma";
import { readGalleryScope } from "@/lib/web/public-scope";
import { readPublicRequest } from "@/lib/web/request";
import { resolveGallerySelection, readGalleryFilters } from "@/lib/web/query";
import { sourceFile, downloadHeaders, safeName } from "@/lib/workspace/files";
import { shareCopy } from "@/lib/web/share-copy";
import { MAX_EXCEL_PHOTOS, photoWorkbook } from "@/lib/web/excel-photos";
export const runtime = "nodejs";
export const maxDuration = 300;
let activeExports = 0;
export async function POST(req: Request) {
  if (activeExports >= 2)
    return NextResponse.json(
      { error: "EXPORT_BUSY" },
      { status: 429, headers: { "Retry-After": "10" } },
    );
  activeExports++;
  try {
    let body;
    try {
      body = await readPublicRequest(req);
    } catch {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    }
    let scope;
    try {
      scope = readGalleryScope(body.scope);
    } catch {
      return NextResponse.json({ error: "INVALID_SCOPE" }, { status: 400 });
    }
    if (body.format !== "zip" && body.format !== "xlsx")
      return NextResponse.json({ error: "INVALID_SELECTION" }, { status: 400 });
    if (body.includeImages !== undefined && typeof body.includeImages !== "boolean")
      return NextResponse.json({ error: "INVALID_SELECTION" }, { status: 400 });
    // Legacy API callers retain text-only exports and the existing 5,000-row limit.
    const includeImages = body.format === "xlsx" && body.includeImages === true;
    const limit = body.format === "zip" ? 200 : includeImages ? MAX_EXCEL_PHOTOS : 5000;
    let selectedWhere;
    try {
      selectedWhere = await resolveGallerySelection(
        { ...body, scope },
        limit,
      );
    } catch (e) {
      return NextResponse.json(
        { error: (e as Error).message },
        { status: (e as Error).message === "PHOTOS_UNAVAILABLE" ? 404 : 400 },
      );
    }
    const sort = readGalleryFilters(body.filters).sort as "asc" | "desc";
    const photos = await prisma.photo.findMany({
      where: selectedWhere,
      take: limit,
      orderBy: [{ timestamp: sort }, { photoID: sort }],
    });
    const filename = `Timeprint-${scope.kind}-${new Date().toISOString().slice(0, 10)}`;
    if (includeImages) {
      const locale = typeof body.locale === "string" ? body.locale : "";
      const galleryURL = new URL(`/web/${scope.kind}/${encodeURIComponent(scope.id)}/photos`, req.url);
      if (locale) galleryURL.searchParams.set("lang", resolveLocale(locale));
      const signal = AbortSignal.any([req.signal, AbortSignal.timeout(240_000)]);
      const book = await photoWorkbook({ photos, galleryURL: galleryURL.toString(), locale, signal });
      signal.throwIfAborted();
      const data = await book.xlsx.writeBuffer();
      signal.throwIfAborted();
      return new Response(new Uint8Array(data), {
        headers: {
          ...downloadHeaders(`${filename}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
          "Content-Length": String(data.byteLength),
        },
      });
    }
    if (body.format === "xlsx") {
      const locale = typeof body.locale === "string" ? body.locale : "";
      const t = shareCopy(locale);
      const book = new ExcelJS.Workbook();
      book.creator = "Timeprint";
      const sheet = book.addWorksheet("Photos", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      sheet.columns = [
        { header: t("filename"), key: "file", width: 42 },
        { header: t("time"), key: "time", width: 25 },
        { header: "Timezone", key: "zone", width: 23 },
        { header: t("project"), key: "project", width: 26 },
        { header: t("member"), key: "member", width: 22 },
        { header: t("location"), key: "location", width: 65 },
        { header: "GPS latitude", key: "lat", width: 18 },
        { header: "GPS longitude", key: "lng", width: 18 },
        { header: t("type"), key: "type", width: 12 },
        { header: "Photo ID", key: "id", width: 32 },
      ];
      for (const p of photos)
        sheet.addRow({
          file: p.localPhotoName || p.photoID,
          time: formatDateTime(
            new Date(Number(p.timestamp)),
            resolveLocale(locale),
            photoTimeZone(p.takePhotoTimezoneID),
          ),
          zone: p.takePhotoTimezoneID,
          project: p.projectName,
          member: p.userName,
          location: p.location,
          lat: p.lat == null ? null : Number(p.lat),
          lng: p.lng == null ? null : Number(p.lng),
          type: t(p.mediaType === 1 ? "video" : "photo"),
          id: p.photoID,
        });
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF255DDF" },
      };
      sheet.autoFilter = { from: "A1", to: `J${photos.length + 1}` };
      const data = await book.xlsx.writeBuffer();
      return new Response(new Uint8Array(data), {
        headers: downloadHeaders(
          `${filename}.xlsx`,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      });
    }
    // Build completely before returning success; failed/oversize sources never masquerade as a finished ZIP.
    const archive = new ZipArchive({ zlib: { level: 1 } });
    const chunks: Buffer[] = [];
    let zipBytes = 0;
    const completion = new Promise<Buffer>((resolve, reject) => {
      archive.on("data", (chunk: Buffer) => {
        zipBytes += chunk.length;
        if (zipBytes > 128 * 1024 * 1024) {
          archive.abort();
          reject(new Error("TOO_LARGE"));
        } else chunks.push(chunk);
      });
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
    });
    // Attach immediately: an archive error can happen while the next file is being fetched.
    void completion.catch(() => {});
    let total = 0;
    try {
      for (const [i, p] of photos.entries()) {
        if (req.signal.aborted) throw new Error("CANCELLED");
        const source = await sourceFile(p.largeURL || p.smallURL, req.signal);
        const parts: Buffer[] = [];
        let size = 0;
        for await (const chunk of source.stream) {
          const part = Buffer.from(chunk);
          size += part.length;
          total += part.length;
          if (size > 64 * 1024 * 1024 || total > 100 * 1024 * 1024) {
            source.stream.destroy();
            throw new Error("TOO_LARGE");
          }
          parts.push(part);
        }
        archive.append(Buffer.concat(parts), {
          name: `${String(i + 1).padStart(4, "0")}-${safeName(p.localPhotoName || p.photoID + source.extension)}`,
        });
      }
      await archive.finalize();
      const zip = await completion;
      return new Response(new Uint8Array(zip), {
        headers: downloadHeaders(`${filename}.zip`, "application/zip"),
      });
    } catch (e) {
      archive.abort();
      throw e;
    }
  } catch (error) {
    // Keep a diagnostic without logging photo metadata, source URLs or request bodies.
    console.error("[photos/export] Generation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      frame: error instanceof Error ? error.stack?.split("\n")[1]?.trim() : undefined,
    });
    if (error instanceof Error && error.name === "TimeoutError")
      return NextResponse.json({ error: "EXPORT_TIMEOUT" }, { status: 504 });
    return NextResponse.json({ error: "EXPORT_FAILED" }, { status: 502 });
  } finally {
    activeExports--;
  }
}
