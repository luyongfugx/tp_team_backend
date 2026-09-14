import ExcelJS from "exceljs";
import sharp from "sharp";
import type { Photo } from "@prisma/client";
import { sourceFile } from "@/lib/workspace/files";
import { parseOffsetMinutes, photoTimeZone } from "@/app/web/photos-data";
import { shareCopy } from "./share-copy";

export const MAX_EXCEL_PHOTOS = 200;
export const MAX_THUMBNAIL_BYTES = 90 * 1024;
type Thumbnail = { data: Buffer; width: number; height: number };
type ExportPhoto = Pick<Photo, "photoID" | "localPhotoName" | "timestamp" | "takePhotoTimezoneID" | "projectName" | "userName" | "location" | "lat" | "lng" | "mediaType" | "smallURL" | "largeURL">;

export async function compressExcelThumbnail(input: Buffer): Promise<Thumbnail> {
  const raster = input[0] === 0xff && input[1] === 0xd8 ||
    input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    input.subarray(0, 3).toString() === "GIF" || input.subarray(0, 4).toString() === "RIFF" ||
    input.subarray(4, 8).toString() === "ftyp" || ["49492a00", "4d4d002a"].includes(input.subarray(0, 4).toString("hex"));
  if (!raster) throw new Error("INVALID_IMAGE");
  const options = { limitInputPixels: 40_000_000, failOn: "error" as const };
  const metadata = await sharp(input, options).metadata();
  // Raster formats only: never render uploaded SVGs with external resources.
  if (!["jpeg", "png", "webp", "avif", "heif", "gif", "tiff"].includes(metadata.format || "")) throw new Error("INVALID_IMAGE");
  for (const [edge, quality] of [[960, 80], [960, 65], [768, 65], [640, 55], [480, 45], [320, 40]]) {
    const { data, info } = await sharp(input, options)
      .rotate().resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (data.length <= MAX_THUMBNAIL_BYTES) return { data, width: info.width, height: info.height };
  }
  throw new Error("IMAGE_TOO_LARGE");
}

async function loadThumbnail(photo: ExportPhoto, signal: AbortSignal): Promise<Thumbnail | null> {
  // Videos use only their existing preview, never download/decode the video.
  const candidates = [...new Set(photo.mediaType === 1 ? [photo.smallURL] : [photo.smallURL, photo.largeURL])].filter(Boolean);
  for (const candidate of candidates) {
    signal.throwIfAborted();
    const timeout = AbortSignal.any([signal, AbortSignal.timeout(12_000)]);
    try {
      const file = await sourceFile(candidate!, timeout);
      const parts: Buffer[] = [];
      let size = 0;
      try {
        for await (const chunk of file.stream) {
          timeout.throwIfAborted();
          const data = Buffer.from(chunk);
          size += data.length;
          if (size > 12 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");
          parts.push(data);
        }
      } finally { file.stream.destroy(); }
      const thumbnail = await compressExcelThumbnail(Buffer.concat(parts));
      signal.throwIfAborted();
      return thumbnail;
    } catch {
      signal.throwIfAborted();
      // A missing thumbnail can fall back to the photo's full-size source.
    }
  }
  return null;
}

function excelCaptureDate(timestamp: bigint, zone: string) {
  const timeZone = photoTimeZone(zone);
  const offset = parseOffsetMinutes(timeZone);
  // Mobile clients also store GMT+0800 / UTC+8. Intl accepts IANA names,
  // so shift fixed-offset capture times explicitly and format them in UTC.
  const date = new Date(Number(timestamp) + (offset ?? 0) * 60_000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: offset == null ? timeZone : "UTC", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const part = (name: string) => Number(parts.find(p => p.type === name)?.value);
  // Excel has no timezone type: store the capture wall-clock time and retain
  // its capture timezone in a separate column, independent of the server timezone.
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second")));
}

export async function photoWorkbook(options: {
  photos: ExportPhoto[];
  galleryURL: string;
  locale: string;
  signal: AbortSignal;
  load?: (photo: ExportPhoto, signal: AbortSignal) => Promise<Thumbnail | null>;
}) {
  const { photos, galleryURL, locale, signal, load = loadThumbnail } = options;
  if (photos.length > MAX_EXCEL_PHOTOS) throw new Error("TOO_MANY_PHOTOS");
  const t = shareCopy(locale);
  const book = new ExcelJS.Workbook();
  book.creator = "Timeprint";
  const sheet = book.addWorksheet("Photos", {
    views: [{ state: "frozen", ySplit: 2, xSplit: 1, showGridLines: false }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:2" },
  });
  sheet.columns = [
    { key: "photo", width: 25 }, { key: "project", width: 23 }, { key: "member", width: 22 },
    { key: "date", width: 14 }, { key: "time", width: 12 }, { key: "location", width: 42 },
    { key: "gps", width: 25 }, { key: "file", width: 32 }, { key: "zone", width: 23 },
    { key: "type", width: 12 }, { key: "link", width: 20 },
  ];
  sheet.mergeCells("A1:K1");
  sheet.getCell("A1").value = { text: `${t("excelViewPhotos")} · Timeprint`, hyperlink: galleryURL };
  sheet.getCell("A1").font = { name: "Arial", size: 12, color: { argb: "FF007BFF" }, underline: true };
  sheet.getRow(1).height = 35;
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.getRow(2).values = [t("photo"), t("project"), t("member"), t("excelDate"), t("excelTime"), t("location"), t("excelGPS"), t("filename"), t("excelTimezone"), t("excelMediaType"), t("excelViewOriginal")];
  sheet.getRow(2).height = 28;
  sheet.getRow(2).eachCell(cell => {
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF303844" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF3FF" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  for (const photo of photos) {
    const date = excelCaptureDate(photo.timestamp, photo.takePhotoTimezoneID);
    const link = new URL(galleryURL);
    link.searchParams.set("photo", photo.photoID);
    const row = sheet.addRow({ project: photo.projectName, member: photo.userName, date, time: date,
      location: photo.location, gps: photo.lat != null && photo.lng != null ? `${photo.lat}, ${photo.lng}` : null,
      file: photo.localPhotoName || photo.photoID, zone: photoTimeZone(photo.takePhotoTimezoneID),
      type: t(photo.mediaType === 1 ? "video" : "photo"), link: { text: t("excelViewOriginal"), hyperlink: link.toString() },
    });
    row.height = 170;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { name: "Arial", size: 11, color: { argb: "FF303844" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FFE1E4E9" } } };
    });
    row.getCell("date").numFmt = "yyyy-mm-dd";
    row.getCell("time").numFmt = "hh:mm:ss";
    row.getCell("link").font = { name: "Arial", size: 11, color: { argb: "FF007BFF" }, underline: true };
  }
  // Bounded parallelism: fetch at most three images, never all 200 at once.
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, photos.length) }, async () => {
    while (next < photos.length) {
      signal.throwIfAborted();
      const index = next++, photo = photos[index], row = sheet.getRow(index + 3);
      const thumb = await load(photo, signal);
      signal.throwIfAborted();
      if (!thumb) { row.getCell("photo").value = t(photo.mediaType === 1 ? "excelVideoPreview" : "photoFailed"); continue; }
      const id = book.addImage({ buffer: thumb.data as never, extension: "jpeg" });
      const ratio = Math.min(165 / thumb.width, 210 / thumb.height);
      const width = thumb.width * ratio, height = thumb.height * ratio;
      const anchor = (x: number, y: number) => ({
        nativeCol: 0, nativeColOff: Math.round(x * 9525),
        nativeRow: index + 2, nativeRowOff: Math.round(y * 9525),
      }) as ExcelJS.Anchor;
      const photoLink = new URL(galleryURL);
      photoLink.searchParams.set("photo", photo.photoID);
      // Both anchors stay inside this row, so filtering/resizing keeps images
      // associated with their records. Preserve aspect ratio and the full watermark.
      sheet.addImage(id, {
        // Native EMU offsets avoid ExcelJS's fractional-column conversion,
        // which does not use the actual pixel width for custom-width columns.
        tl: anchor((180 - width) / 2, (226.67 - height) / 2),
        br: anchor((180 + width) / 2, (226.67 + height) / 2),
        editAs: "twoCell", hyperlinks: { hyperlink: photoLink.toString(), tooltip: t("excelViewOriginal") },
      });
    }
  }));
  sheet.autoFilter = { from: "A2", to: `K${photos.length + 2}` };
  return book;
}
