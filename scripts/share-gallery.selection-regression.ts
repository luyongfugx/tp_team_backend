import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
const database = new URL(process.env.DATABASE_URL || "");
if (
  database.hostname !== "127.0.0.1" ||
  database.pathname !== "/tp_team_backend_local"
)
  throw Error("Local test only");
const db = new PrismaClient(),
  base = "http://127.0.0.1:3000",
  scope = { kind: "team", id: "local-share-perf-10000" };
const post = async (body: unknown) => {
  const r = await fetch(base + "/api/web/photos/list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(r.status, 200);
  return r.json();
};
async function main() {
  const first = await post({ scope, page: 1, locale: "zh-Hans" });
  const id = "perf-test-late-upload";
  const source = await db.photo.findUniqueOrThrow({
    where: { photoID: "perf-photo-00000" },
  });
  try {
    await db.photo.create({
      data: {
        photoID: id,
        groupID: source.groupID,
        projectID: source.projectID,
        userID: source.userID,
        timestamp: source.timestamp + BigInt(10000),
        takePhotoFormatTime: source.takePhotoFormatTime,
        takePhotoTimezoneID: source.takePhotoTimezoneID,
        ossFileName: "perf-late",
        smallURL: source.smallURL,
        largeURL: source.largeURL,
      },
    });
    const frozen = await post({ scope, page: 1, snapshot: first.snapshot });
    assert.equal(frozen.total, 10000);
    assert.deepEqual(
      frozen.photos.map((p: any) => p.photoID),
      first.photos.map((p: any) => p.photoID),
    );
    assert.equal((await post({ scope, page: 1 })).total, 10001);
  } finally {
    await db.photo.deleteMany({ where: { photoID: id, groupID: scope.id } });
  }
  const focused = await post({
    scope,
    mode: "focused",
    photoID: "perf-photo-09999",
    snapshot: first.snapshot,
  });
  assert.equal(focused.page, 209);
  assert.equal(focused.photos[0].photoID, "perf-photo-09999");
  const response = await fetch(base + "/api/web/photos/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope,
      filters: { q: "工地 A" },
      all: true,
      excluded: ["perf-photo-00001"],
      snapshot: first.snapshot,
      format: "xlsx",
      locale: "zh-Hans",
    }),
  });
  assert.equal(response.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.rowCount, 5000);
  for (let row = 2; row <= sheet.rowCount; row++)
    assert.notEqual(sheet.getCell(`J${row}`).value, "perf-photo-00001");
  const html = await (
    await fetch(base + "/web/team/local-share-perf-10000/photos")
  ).text();
  assert.ok(!html.includes("perf-photo-09999"));
  assert.ok(html.includes("perf-photo-00047"));
  console.log(
    JSON.stringify({
      snapshot: "new upload does not reorder existing pages",
      deepLinkPage: focused.page,
      xlsxSelected: 4999,
      htmlBytes: Buffer.byteLength(html),
      firstPageContains48Rows: true,
    }),
  );
}
main().finally(() => db.$disconnect());
