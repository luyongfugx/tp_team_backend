import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import ExcelJS from "exceljs";
const database = new URL(process.env.DATABASE_URL || "");
if (!["127.0.0.1", "localhost"].includes(database.hostname) || database.pathname !== "/tp_team_backend_local") throw new Error("Local demo database only");
const db = new PrismaClient();
const prefix = `local-excel-${Date.now()}`;
const ids = [prefix + "-portrait", prefix + "-landscape", prefix + "-missing"];
const files = [`public/workspace-demo/${prefix}-portrait.jpg`, `public/workspace-demo/${prefix}-landscape.jpg`];
async function run() {
try {
  const base = await db.photo.findFirstOrThrow({ where: { groupID: "local-workspace-demo", deletedAt: null } });
  await mkdir(".local/excel-reference", { recursive: true });
  await mkdir("public/workspace-demo", { recursive: true });
  for (const [i, size] of [[480, 640], [960, 540]].entries()) {
    const image = await sharp({ create: { width: size[0], height: size[1], channels: 3, background: i ? "#509d80" : "#508ddd" } }).jpeg().toBuffer();
    await writeFile(files[i], image);
  }
  for (const [i, id] of ids.entries()) await db.photo.create({ data: {
    photoID: id, groupID: base.groupID, projectID: base.projectID, userID: base.userID,
    timestamp: base.timestamp, takePhotoFormatTime: base.takePhotoFormatTime,
    takePhotoTimezoneID: base.takePhotoTimezoneID, ossFileName: id,
    projectName: base.projectName, userName: base.userName, location: base.location,
    lat: base.lat, lng: base.lng, localPhotoName: `Excel-test-${i + 1}.jpg`,
    smallURL: i < 2 ? `/workspace-demo/${prefix}-${i ? "landscape" : "portrait"}.jpg` : null,
    largeURL: null, mediaType: 0,
  } });
  const request = (extra = {}) => fetch("http://127.0.0.1:3000/api/web/photos/export", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope: { kind: "team", id: base.groupID }, ids, format: "xlsx", locale: "zh-Hans", includeImages: true, ...extra }),
  });
  const response = await request();
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(".local/excel-reference/api-example.xlsx", bytes);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as never);
  const sheet = book.worksheets[0];
  assert.equal(sheet.rowCount, 5);
  assert.equal(sheet.getCell("A2").value, "照片");
  assert.equal(sheet.getImages().length, 2);
  const missingRow = [3, 4, 5].find(n => sheet.getCell(`K${n}`).hyperlink.includes(ids[2]));
  assert.ok(missingRow);
  assert.equal(sheet.getCell(`A${missingRow}`).value, "图片未能加载");
  const legacy = await request({ includeImages: false });
  const legacyBook = new ExcelJS.Workbook(); await legacyBook.xlsx.load(Buffer.from(await legacy.arrayBuffer()) as never);
  assert.equal(legacyBook.worksheets[0].getCell("A1").value, "文件名");
  assert.equal(legacyBook.worksheets[0].getImages().length, 0);
  assert.equal((await request({ includeImages: "true" })).status, 400);
  assert.equal((await request({ ids: Array.from({ length: 201 }, (_, i) => `photo-${i}`) })).status, 400);
  assert.equal((await request({ ids: ["not-in-this-scope"] })).status, 404);
  console.log(JSON.stringify({ imageCount: 2, rows: 3, missingPreviewPreserved: true, legacyTextCompatible: true, bytes: bytes.length }));
} finally {
  await db.photo.deleteMany({ where: { photoID: { in: ids } } });
  await Promise.all(files.map(file => rm(file, { force: true })));
  await db.$disconnect();
}
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
