// Local-only authenticated Excel regression; requires the local Next server.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import sharp from "sharp";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";
import { POST } from "../app/api/workspace/photos/export/route";

async function main() {
  const database = new URL(process.env.DATABASE_URL || "");
  if (!["localhost", "127.0.0.1"].includes(database.hostname) || database.pathname !== "/tp_team_backend_local")
    throw new Error("Local fixture database required");
  const groupID = "local-workspace-demo", prefix = `local-ws-excel-${randomBytes(6).toString("hex")}`;
  const ids = Array.from({ length: 201 }, (_, i) => `${prefix}-${i}`), sessions: string[] = [];
  const file = `public/workspace-demo/${prefix}.jpg`;
  const originalCount = prisma.photo.count;
  async function tokenFor(email: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const token = randomBytes(32).toString("hex");
    await prisma.session.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 3600000) } });
    sessions.push(token);
    return { token, id: user.id };
  }
  const body = { groupID, filters: { tz: "Asia/Shanghai", q: prefix }, format: "xlsx", locale: "zh-Hans",
    title: "Excel 回归", selection: { mode: "ids", ids: ids.slice(0, 4), excluded: [] }, expectedCount: 4 };
  function request(token: string, extra = {}) {
    return new Request("http://127.0.0.1:3000/api/workspace/photos/export", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ...extra }),
    });
  }
  async function failure(token: string, extra: object, status: number, code: string) {
    const response = await fetch(request(token, extra));
    assert.equal(response.status, status);
    assert.equal((await response.json()).error, code);
  }
  async function workbook(token: string, extra: object, count: number, galleryPath: string) {
    const response = await fetch(request(token, extra));
    assert.equal(response.status, 200, response.status === 200 ? undefined : await response.text());
    assert.equal(response.headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.match(response.headers.get("Content-Disposition")!, /\.xlsx/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(Number(response.headers.get("Content-Length")), bytes.length);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as never);
    const sheet = book.worksheets[0];
    assert.equal(sheet.rowCount, count + 2);
    const gallery = new URL(sheet.getCell("A1").hyperlink);
    assert.equal(gallery.origin, new URL(process.env.TEAMSPACE_PUBLIC_ORIGIN || "https://teamspace.timeprint.net").origin);
    assert.equal(gallery.pathname, galleryPath);
    for (let row = 3; row <= count + 2; row++) {
      assert.equal(new URL(sheet.getCell(`K${row}`).hyperlink).pathname, galleryPath);
      assert.equal(sheet.getCell(`I${row}`).value, "GMT+0800");
    }
    return sheet;
  }
  try {
    const owner = await tokenFor("local-test@example.com"), member = await tokenFor("workspace-demo-lin@example.com");
    const projects = await prisma.project.findMany({ where: { groupID, deletedAt: null }, take: 2 });
    assert.equal(projects.length, 2);
    await mkdir("public/workspace-demo", { recursive: true });
    await writeFile(file, await sharp({ create: { width: 480, height: 640, channels: 3, background: "#378dcc" } }).jpeg().toBuffer());
    await prisma.photo.createMany({ data: ids.map((photoID, i) => ({
      photoID, groupID, userID: i < 2 ? member.id : owner.id,
      projectID: projects[i === 3 ? 1 : 0].projectID, projectName: projects[i === 3 ? 1 : 0].projectName,
      userName: i < 2 ? "Member" : "Owner", timestamp: BigInt(Date.UTC(2026, 8, i < 2 ? 14 : 13, 16, 30)),
      takePhotoFormatTime: i < 2 ? "2026-09-15 00:30:00" : "2026-09-14 00:30:00",
      takePhotoTimezoneID: "GMT+0800", ossFileName: photoID, localPhotoName: `${photoID}.jpg`,
      smallURL: i === 2 ? null : `/workspace-demo/${prefix}.jpg`, mediaType: i === 2 ? 1 : 0,
    })) });
    const teamPath = `/web/team/${groupID}/photos`;
    const sheet = await workbook(owner.token, {}, 4, teamPath);
    assert.equal(sheet.getImages().length, 3);
    const selectedIDs = [3, 4, 5, 6].map(row => new URL(sheet.getCell(`K${row}`).hyperlink).searchParams.get("photo"));
    assert.deepEqual(new Set(selectedIDs), new Set(ids.slice(0, 4)));
    const allSelection = { mode: "all", ids: [], excluded: [] };
    const memberFilters = { ...body.filters, userID: member.id };
    await workbook(owner.token, { filters: memberFilters, selection: allSelection, expectedCount: 2 }, 2, `/web/user/${member.id}/photos`);
    await workbook(owner.token, { filters: { ...body.filters, projectID: String(projects[0].projectID) },
      selection: { mode: "ids", ids: ids.slice(0, 3), excluded: [] }, expectedCount: 3 }, 3, `/web/project/${projects[0].projectID}/photos`);
    await workbook(owner.token, { filters: { ...body.filters, from: "2026-09-15", to: "2026-09-15" }, selection: allSelection, expectedCount: 2 }, 2, teamPath);
    await workbook(owner.token, { filters: memberFilters, selection: { ...allSelection, excluded: [ids[0]] }, expectedCount: 1 }, 1, `/web/user/${member.id}/photos`);
    await workbook(member.token, { selection: allSelection, expectedCount: 2 }, 2, teamPath);
    await failure("", {}, 401, "UNAUTHORIZED");
    await failure(owner.token, { groupID: "not-my-team" }, 403, "FORBIDDEN");
    await failure(member.token, {}, 409, "SCOPE_CHANGED");
    await failure(member.token, { filters: { ...body.filters, userID: owner.id }, selection: allSelection }, 400, "NO_PHOTOS");
    await failure(owner.token, { selection: allSelection, expectedCount: 201 }, 400, "DIRECT_EXPORT_LIMIT");
    await failure(owner.token, { expectedCount: 5 }, 409, "SCOPE_CHANGED");
    await failure(owner.token, { format: "pdf" }, 400, "INVALID_REQUEST");
    await failure(owner.token, { filters: { tz: "bad-zone" } }, 400, "INVALID_FILTER");
    const page = await workbook(owner.token, { selection: { mode: "ids", ids: ids.slice(0, 48), excluded: [] }, expectedCount: 48 }, 48, teamPath);
    assert.equal(page.getImages().length, 47);
    // Losing access while generation is in progress must not release a workbook.
    prisma.photo.count = (async () => 0) as typeof originalCount;
    const recheck = await POST(request(owner.token));
    assert.equal(recheck.status, 409);
    assert.equal((await recheck.json()).error, "SCOPE_CHANGED");
    console.log("PASS: authenticated Excel, embedded images, canonical links, team/project/member/date scopes, current page, all-minus selections, ordinary-member access, 200-item limit and final access recheck");
  } finally {
    prisma.photo.count = originalCount;
    await prisma.photo.deleteMany({ where: { photoID: { in: ids } } });
    await prisma.session.deleteMany({ where: { token: { in: sessions } } });
    await prisma.$disconnect();
    await rm(file, { force: true });
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
