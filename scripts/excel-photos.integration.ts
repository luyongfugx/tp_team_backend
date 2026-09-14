import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import ExcelJS from "exceljs";
import { shareCopy } from "../lib/web/share-copy";
import { loadTeamspaceTranslations, isRTLTeamspaceLocale } from "../lib/teamspace/translations";
import { gpsColumnLabels } from "../lib/teamspace/gps-labels";
const database = new URL(process.env.DATABASE_URL || "");
if (!["127.0.0.1", "localhost"].includes(database.hostname) || database.pathname !== "/tp_team_backend_local") throw new Error("Local demo database only");
const db = new PrismaClient();
const prefix = `local-excel-${Date.now()}`;
const ids = [prefix + "-portrait", prefix + "-landscape", prefix + "-missing"];
const bulkIds = Array.from({ length: 200 }, (_, i) => `${prefix}-bulk-${i}`);
const files = [`public/workspace-demo/${prefix}-portrait.jpg`, `public/workspace-demo/${prefix}-landscape.jpg`];
async function run() {
try {
  const base = await db.photo.findFirstOrThrow({ where: { groupID: "local-workspace-demo", deletedAt: null } });
  await mkdir(".local/excel-reference", { recursive: true });
  await mkdir("public/workspace-demo", { recursive: true });
  for (const [i, size] of [[480, 640], [960, 540]].entries()) {
    // Detailed, deterministic raster inputs exercise compression and workbook size.
    const pixels = Buffer.alloc(size[0] * size[1] * 3);
    let seed = 123 + i;
    for (let n = 0; n < pixels.length; n++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels[n] = seed >>> 24; }
    const image = await sharp(pixels, { raw: { width: size[0], height: size[1], channels: 3 } }).jpeg({ quality: 85 }).toBuffer();
    await writeFile(files[i], image);
  }
  for (const [i, id] of ids.entries()) await db.photo.create({ data: {
    photoID: id, groupID: base.groupID, projectID: base.projectID, userID: base.userID,
    timestamp: BigInt(Date.UTC(2026, 8, 14, 16, 30)), takePhotoFormatTime: "2026-09-15 00:30:00",
    takePhotoTimezoneID: "GMT+0800", ossFileName: id,
    projectName: base.projectName, userName: base.userName, location: base.location,
    lat: base.lat, lng: base.lng, localPhotoName: `Excel-test-${i + 1}.jpg`,
    smallURL: i < 2 ? `/workspace-demo/${prefix}-${i ? "landscape" : "portrait"}.jpg` : null,
    largeURL: null, mediaType: 0,
  } });
  const request = (extra = {}) => fetch("http://127.0.0.1:3000/api/web/photos/export", {
    // A proxy's internal origin and untrusted forwarding headers must never
    // become links in a workbook downloaded by another person.
    method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Host": "untrusted.example", "X-Forwarded-Proto": "https" },
    body: JSON.stringify({ scope: { kind: "team", id: base.groupID }, ids, format: "xlsx", locale: "zh-Hans", includeImages: true, ...extra }),
  });
  const response = await request();
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(Number(response.headers.get("content-length")), bytes.length);
  await writeFile(".local/excel-reference/api-example.xlsx", bytes);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as never);
  const sheet = book.worksheets[0];
  const gallery = new URL(`/web/team/${base.groupID}/photos?lang=zh-Hans`, process.env.TEAMSPACE_PUBLIC_ORIGIN || "https://teamspace.timeprint.net").toString();
  assert.equal(sheet.getCell("A1").hyperlink, gallery);
  for (const row of [3, 4, 5]) {
    const link = new URL(sheet.getCell(`K${row}`).hyperlink);
    assert.equal(link.origin, new URL(gallery).origin);
    assert.equal(link.pathname, new URL(gallery).pathname);
    assert.equal(link.searchParams.get("lang"), "zh-Hans");
    assert.ok(ids.includes(link.searchParams.get("photo")!));
  }
  for (const image of sheet.getImages()) {
    const link = (image.range as ExcelJS.ImageRange & { hyperlinks: { hyperlink: string } }).hyperlinks.hyperlink;
    assert.equal(new URL(link).origin, new URL(gallery).origin);
    assert.ok(ids.includes(new URL(link).searchParams.get("photo")!));
  }
  assert.equal(sheet.rowCount, 5);
  assert.equal(sheet.getCell("A2").value, "照片");
  assert.equal(sheet.getImages().length, 2);
  assert.equal((sheet.getCell("D3").value as Date).toISOString(), "2026-09-15T00:30:00.000Z");
  const missingRow = [3, 4, 5].find(n => sheet.getCell(`K${n}`).hyperlink.includes(ids[2]));
  assert.ok(missingRow);
  assert.equal(sheet.getCell(`A${missingRow}`).value, "图片未能加载");
  const legacy = await request({ includeImages: false });
  const legacyBook = new ExcelJS.Workbook(); await legacyBook.xlsx.load(Buffer.from(await legacy.arrayBuffer()) as never);
  assert.equal(legacyBook.worksheets[0].getCell("A1").value, "文件名");
  assert.equal(legacyBook.worksheets[0].getImages().length, 0);
  for (const locale of ["de", "ar", "ja", "rw"]) {
    const result = await request({ includeImages: false, locale });
    assert.equal(result.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await result.arrayBuffer()) as never);
    const localized = workbook.worksheets[0];
    const t = shareCopy(locale, await loadTeamspaceTranslations(locale));
    assert.equal(localized.name, t("photo"));
    assert.equal(localized.columnCount, 10);
    assert.equal(localized.rowCount, 4);
    assert.equal(localized.getCell("C1").value, t("excelTimezone"));
    assert.deepEqual([localized.getCell("G1").value, localized.getCell("H1").value], gpsColumnLabels(locale));
    assert.equal(localized.getCell("I1").value, t("excelMediaType"));
    assert.equal(!!localized.views[0].rightToLeft, isRTLTeamspaceLocale(locale));
    if (locale === "rw") assert.ok(localized.getRow(1).height >= 70);
    assert.equal(localized.getCell("C2").value, "GMT+0800");
    assert.ok(ids.includes(String(localized.getCell("J2").value)));
  }
  assert.equal((await request({ includeImages: "true" })).status, 400);
  assert.equal((await request({ ids: Array.from({ length: 201 }, (_, i) => `photo-${i}`) })).status, 400);
  assert.equal((await request({ ids: ["not-in-this-scope"] })).status, 404);
  console.log(JSON.stringify({ imageCount: 2, rows: 3, missingPreviewPreserved: true, legacyTextCompatible: true, bytes: bytes.length }));
  await db.photo.createMany({ data: bulkIds.map((id, i) => ({
    photoID: id, groupID: base.groupID, projectID: base.projectID, userID: base.userID,
    timestamp: BigInt(Date.UTC(2026, 8, 14, 16, 30)), takePhotoFormatTime: "2026-09-15 00:30:00",
    takePhotoTimezoneID: "GMT+0800", ossFileName: id,
    projectName: base.projectName, userName: base.userName, location: base.location,
    localPhotoName: `Bulk-${i}.jpg`, mediaType: 0,
    smallURL: `/workspace-demo/${prefix}-${i % 2 ? "landscape" : "portrait"}.jpg`,
  })) });
  for (const count of [48, 200]) {
    const started = performance.now();
    const result = await request({ ids: bulkIds.slice(0, count) });
    assert.equal(result.status, 200);
    const data = Buffer.from(await result.arrayBuffer());
    const elapsedMs = Math.round(performance.now() - started);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(data as never);
    assert.equal(workbook.worksheets[0].rowCount, count + 2);
    const images = workbook.worksheets[0].getImages();
    assert.equal(images.length, count);
    for (const image of images) {
      const media = workbook.getImage(Number(image.imageId));
      assert.ok(media.buffer!.byteLength <= 90 * 1024);
      assert.equal(image.range.tl.nativeRow, image.range.br!.nativeRow);
    }
    console.log(JSON.stringify({ rows: count, embeddedImages: images.length, bytes: data.length, elapsedMs }));
  }
} finally {
  await db.photo.deleteMany({ where: { photoID: { in: [...ids, ...bulkIds] } } });
  await Promise.all(files.map(file => rm(file, { force: true })));
  await db.$disconnect();
}
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
