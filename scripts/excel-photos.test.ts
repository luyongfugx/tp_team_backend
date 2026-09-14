import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { compressExcelThumbnail, MAX_THUMBNAIL_BYTES, photoWorkbook } from "../lib/web/excel-photos";
import { exportGalleryURL } from "../lib/web/gallery-url";
const photo = {
  photoID: "photo-a", localPhotoName: '=SUM(1,2).jpg', timestamp: BigInt(Date.UTC(2026, 8, 14, 16, 30)),
  takePhotoTimezoneID: "Asia/Shanghai", projectName: "Project", userName: "Member", location: "Site",
  lat: null, lng: null, mediaType: 0, smallURL: null, largeURL: null,
};
const signal = () => new AbortController().signal;

test("export links use the public origin for project, team and member scopes", () => {
  for (const kind of ["project", "team", "user"] as const) {
    assert.equal(exportGalleryURL({ kind, id: "22" }, "zh-Hans", "https://teamspace.timeprint.net"),
      `https://teamspace.timeprint.net/web/${kind}/22/photos?lang=zh-Hans`);
  }
  assert.equal(exportGalleryURL({ kind: "team", id: "a/b?c" }, "", "https://staging.timeprint.net/"),
    "https://staging.timeprint.net/web/team/a%2Fb%3Fc/photos");
  for (const origin of ["javascript:alert(1)", "https://user:pass@example.com", "https://example.com/path", "https://example.com?query=1"]) {
    assert.throws(() => exportGalleryURL({ kind: "team", id: "22" }, "en", origin));
  }
});

test("capture dates accept client offset timezones as well as IANA zones", async () => {
  const cases = [
    ["GMT+0800", "2026-09-15T00:30:00.000Z"],
    ["UTC+8", "2026-09-15T00:30:00.000Z"],
    ["+08:00", "2026-09-15T00:30:00.000Z"],
    ["GMT-0330", "2026-09-14T13:00:00.000Z"],
    ["Z", "2026-09-14T16:30:00.000Z"],
    ["America/New_York", "2026-09-14T12:30:00.000Z"],
    ["invalid-zone", "2026-09-15T00:30:00.000Z"],
  ];
  const book = await photoWorkbook({
    photos: cases.map(([zone], i) => ({ ...photo, photoID: `zone-${i}`, takePhotoTimezoneID: zone })),
    galleryURL: 'https://teamspace.timeprint.net/web/team/demo/photos', locale: 'zh-Hans',
    signal: signal(), load: async () => null,
  });
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await book.xlsx.writeBuffer() as never);
  for (const [i, [zone, expected]] of cases.entries()) {
    assert.equal((restored.worksheets[0].getCell(`D${i + 3}`).value as Date).toISOString(), expected, zone);
    assert.equal((restored.worksheets[0].getCell(`E${i + 3}`).value as Date).toISOString(), expected, zone);
  }
});

test("thumbnail compression bounds size, preserves aspect ratio and applies EXIF rotation", async () => {
  const pixels = Buffer.alloc(1200 * 800 * 3);
  let seed = 123;
  for (let i = 0; i < pixels.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels[i] = seed >>> 24; }
  const input = await sharp(pixels, { raw: { width: 1200, height: 800, channels: 3 } }).jpeg({ quality: 95 }).withMetadata({ orientation: 6 }).toBuffer();
  const result = await compressExcelThumbnail(input);
  assert.ok(result.data.length <= MAX_THUMBNAIL_BYTES);
  assert.ok(result.height <= 960);
  assert.ok(Math.abs(result.width / result.height - 2 / 3) < 0.01);
  assert.equal((await sharp(result.data).metadata()).format, "jpeg");
  await assert.rejects(compressExcelThumbnail(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>')), /INVALID_IMAGE/);
});

test("photo workbook embeds row-bound images, typed capture dates, links and missing-preview rows", async () => {
  const thumb = await compressExcelThumbnail(await sharp({ create: { width: 400, height: 600, channels: 3, background: '#509ddd' } }).jpeg().toBuffer());
  const book = await photoWorkbook({ photos: [photo, { ...photo, photoID: 'video-b', mediaType: 1 }], galleryURL: 'https://teamspace.timeprint.net/web/team/demo/photos', locale: 'zh-Hans', signal: signal(), load: async p => p.mediaType ? null : thumb });
  const bytes = await book.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(bytes as never);
  const sheet = restored.worksheets[0];
  assert.equal(sheet.rowCount, 4);
  assert.equal(sheet.getCell('A2').value, '照片');
  assert.equal(sheet.getRow(3).height, 170);
  assert.equal((sheet.views[0] as { ySplit?: number }).ySplit, 2);
  assert.equal((sheet.getCell('D3').value as Date).toISOString(), '2026-09-15T00:30:00.000Z');
  assert.equal(sheet.getCell('H3').value, '=SUM(1,2).jpg');
  assert.equal(sheet.getCell('H3').type, ExcelJS.ValueType.String);
  assert.match(sheet.getCell('K3').hyperlink, /photo=photo-a/);
  assert.match(String(sheet.getCell('A4').value), /视频预览不可用/);
  const images = sheet.getImages();
  assert.equal(images.length, 1);
  assert.equal((images[0].range as ExcelJS.ImageRange & { editAs?: string }).editAs, 'twoCell');
  assert.equal(images[0].range.tl.nativeRow, 2);
  assert.equal(images[0].range.br!.nativeRow, 2);
  const range = images[0].range;
  assert.equal(range.br!.nativeCol, 0);
  const width = (range.br!.nativeColOff - range.tl.nativeColOff) / 9525;
  const height = (range.br!.nativeRowOff - range.tl.nativeRowOff) / 9525;
  assert.ok(width > 130 && width <= 165);
  assert.ok(Math.abs(width / height - 2 / 3) < 0.01);
});

test("image exports cap rows before loading and run at most three thumbnail requests", async () => {
  let active = 0, peak = 0, calls = 0;
  const load = async () => { calls++; peak = Math.max(peak, ++active); await new Promise(r => setTimeout(r, 5)); active--; return null; };
  const options = { galleryURL: 'https://teamspace.timeprint.net/web/team/demo/photos', locale: 'en', signal: signal(), load };
  await assert.rejects(photoWorkbook({ ...options, photos: Array(201).fill(photo) }), /TOO_MANY_PHOTOS/);
  assert.equal(calls, 0);
  await photoWorkbook({ ...options, photos: Array(8).fill(photo) });
  assert.equal(peak, 3);
  assert.equal(calls, 8);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(photoWorkbook({ ...options, photos: [photo], signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 8);
});
