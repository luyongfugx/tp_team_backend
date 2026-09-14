import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { getTeamGallery } from "../app/web/photos-data";
const database = new URL(process.env.DATABASE_URL || "");
if (
  !["127.0.0.1", "localhost"].includes(database.hostname) ||
  database.pathname !== "/tp_team_backend_local"
)
  throw new Error("Local demo database only");
const db = new PrismaClient(),
  base = "http://127.0.0.1:3000",
  scope = { kind: "team", id: "local-workspace-demo" };
async function run() {
  const photos = await db.photo.findMany({
    where: { groupID: scope.id },
    orderBy: { photoID: "asc" },
    take: 3,
  });
  assert.equal(photos.length, 3);
  const ids = photos.map((p) => p.photoID);
  const list = (body: unknown) => fetch(base + "/api/web/photos/list", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  for (const mode of [undefined, "facets", "focused", "day", "selection"]) {
    for (const invalidScope of [undefined, null, {}, { kind: "team", id: { not: "" } }, { kind: "team", id: 1 }]) {
      const r = await list({ scope: invalidScope, mode, photoID: ids[0], day: "2026-09-14", ids });
      assert.equal(r.status, 400);
      assert.equal((await r.json()).error, "INVALID_SCOPE");
    }
  }
  for (const invalid of [
    { filters: { project: "2147483648" } }, { page: 0 }, { page: -1 },
    { mode: "day" }, { mode: "selection", all: "false", ids },
    { mode: ["facets"] },
  ]) assert.equal((await list({ scope, ...invalid })).status, 400);
  const scoped = await list({ scope: { kind: "project", id: String(photos[0].projectID) } });
  const scopedData = await scoped.json();
  assert.ok(scopedData.photos.every((p: { projectID: number }) => p.projectID === photos[0].projectID));
  assert.equal((await list({ scope, mode: "selection", all: true, expectedCount: 1 })).status, 400);
  console.log("All list modes reject missing/malformed scope; scoped queries and stale selection protection passed");
  const data = await getTeamGallery(scope.id, "zh-Hans");
  assert.equal(data.photoCount, 67);
  assert.equal(data.days[0].photos[0].dateKey, "2026-09-14");
  for (const path of [
    `/web/team/${scope.id}/photos`,
    `/web/project/${photos[0].projectID}/photos`,
    `/web/user/${photos[0].userID}/photos`,
  ]) {
    const r = await fetch(base + path);
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(html.includes("share-toolbar"));
    assert.ok(!html.includes("照片验真"));
    console.log("Page OK", path);
  }
  assert.equal(
    (await fetch(base + "/web/project/2147483647/photos")).status,
    404,
  );
  const send = (format: string, extra: Record<string, unknown> = {}) =>
    fetch(base + "/api/web/photos/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, ids, format, locale: "zh-Hans", ...extra }),
    });
  await mkdir(".local/screenshots", { recursive: true });
  const zip = await send("zip");
  assert.equal((await send("zip", { format: ["zip"] })).status, 400);
  assert.equal(zip.status, 200);
  assert.match(zip.headers.get("content-type") || "", /zip/);
  await writeFile(
    ".local/share-test.zip",
    Buffer.from(await zip.arrayBuffer()),
  );
  const excel = await send("xlsx");
  assert.equal(excel.status, 200);
  const excelBytes = Buffer.from(await excel.arrayBuffer());
  await writeFile(".local/share-test.xlsx", excelBytes);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(excelBytes as never);
  const sheet = book.worksheets[0];
  assert.equal(sheet.rowCount, 4);
  assert.equal(sheet.getCell("A1").value, "文件名");
  assert.equal(sheet.getCell("B2").value, "2026/09/14 15:30:00");
  assert.equal(sheet.getCell("G2").value, 31.2304);
  const foreign = await send("zip", {
    scope: { kind: "project", id: String(photos[0].projectID) },
    ids: [photos[1].photoID],
  });
  assert.equal(foreign.status, 404);
  assert.equal((await send("zip", { ids: ["nonexistent"] })).status, 404);
  assert.equal(
    (
      await send("zip", {
        ids: Array.from({ length: 201 }, (_, i) => String(i)),
      })
    ).status,
    400,
  );
  const single = await fetch(
    base + "/api/web/photos/download?photoID=" + ids[0],
  );
  assert.equal(single.status, 200);
  assert.match(single.headers.get("content-disposition") || "", /attachment/);
  assert.ok((await single.text()).includes("<svg"));
  console.log(
    "ZIP, XLSX cells/timezone, single download, missing photo, cross-project rejection and limits passed",
  );
}
run().finally(() => db.$disconnect());
