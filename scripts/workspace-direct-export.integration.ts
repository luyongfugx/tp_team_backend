// Local fixtures only. Run with Node 24 --env-file=.env --import tsx.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm, open } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { POST } from "../app/api/workspace/photos/export/route";
import { GET as history, POST as background } from "../app/api/workspace/exports/route";
import { isWorkspaceExportTableMissing } from "../lib/workspace/server";

async function main() {
const database = new URL(process.env.DATABASE_URL || "");
if (!["localhost", "127.0.0.1"].includes(database.hostname) || database.pathname !== "/tp_team_backend_local")
  throw new Error("Local fixture database required");
const groupID = "local-workspace-demo", sessions: string[] = [];
const directory = await mkdtemp(path.join(tmpdir(), "tp-direct-zip-"));
const largeFixture = `zip-limit-${randomBytes(6).toString("hex")}.jpg`;
const largeFixturePath = path.join(process.cwd(), "public", "workspace-demo", largeFixture);
const body = { groupID, filters: { tz: "Asia/Shanghai" }, groupBy: "member", title: "ZIP 回归",
  selection: { mode: "ids", ids: Array.from({ length: 12 }, (_, i) => `local-demo-photo-${String(i + 1).padStart(3, "0")}`), excluded: [] }, expectedCount: 12 };
async function tokenFor(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { token, userId: user.id, expiresAt: new Date(Date.now() + 3600000) } });
  sessions.push(token);
  return { token, id: user.id };
}
function request(token: string, value: unknown = body) {
  return new Request("http://127.0.0.1:3000/api/workspace/photos/export", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(value),
  });
}
async function error(response: Response, status: number, code: string) {
  assert.equal(response.status, status);
  assert.equal((await response.json()).error, code);
}
async function zip(response: Response, count: number, label: string) {
  assert.equal(response.status, 200, response.status === 200 ? undefined : await response.text());
  assert.equal(response.headers.get("Content-Type"), "application/zip");
  assert.match(response.headers.get("Content-Disposition") || "", /attachment/);
  const file = path.join(directory, `${label}.zip`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  execFileSync("unzip", ["-t", file]); // Checks every file's CRC as well as ZIP structure.
  const names = execFileSync("unzip", ["-Z1", file], { encoding: "utf8" }).trim().split("\n");
  assert.equal(names.length, count);
  assert.equal(new Set(names).size, count);
  assert.ok(names.every(name => name.includes("/") && !name.includes("../")));
  return names;
}
const originalFind = prisma.workspaceExport.findMany, originalCount = prisma.workspaceExport.count;
let changed: { photoID: string; largeURL: string | null; smallURL: string | null } | undefined;
try {
  const owner = await tokenFor("local-test@example.com"), member = await tokenFor("workspace-demo-lin@example.com");
  await error(await POST(request("")), 401, "UNAUTHORIZED");
  await error(await POST(request(owner.token, { ...body, groupID: "not-my-team" })), 403, "FORBIDDEN");
  // Simulate the production P2021 failure in-process; never drop or rename a table.
  const missing = new Prisma.PrismaClientKnownRequestError("missing WorkspaceExport", {
    code: "P2021", clientVersion: Prisma.prismaVersion.client, meta: { modelName: "WorkspaceExport", table: "WorkspaceExport" },
  });
  prisma.workspaceExport.findMany = (() => { throw missing; }) as typeof originalFind;
  prisma.workspaceExport.count = (() => { throw missing; }) as typeof originalCount;
  for (const groupBy of ["member", "project", "date"]) {
    const names = await zip(await POST(request(owner.token, { ...body, groupBy })), 12, groupBy);
    if (groupBy === "date") assert.ok(names.every(name => /^\d{4}-\d{2}-\d{2}\//.test(name)));
    else assert.ok(new Set(names.map(name => name.split("/")[0])).size > 1);
  }
  const unavailable = await history(new Request(`http://127.0.0.1:3000/api/workspace/exports?groupID=${groupID}`, { headers: { Authorization: `Bearer ${owner.token}` } }));
  assert.deepEqual(await unavailable.json(), { jobs: [], backgroundAvailable: false });
  const transaction = prisma.$transaction;
  try {
    prisma.$transaction = (() => { throw missing; }) as typeof transaction;
    await error(await background(request(owner.token)), 503, "EXPORT_SERVICE_UNAVAILABLE");
  } finally { prisma.$transaction = transaction; }
  assert.equal(isWorkspaceExportTableMissing(new Prisma.PrismaClientKnownRequestError("missing Photo", { code: "P2021", clientVersion: "test", meta: { modelName: "Photo", table: "Photo" } })), false);
  console.log("PASS: ZIP integrity, 12 files, three folder modes, missing job-table compatibility and truthful background error");

  const ownPhotos = await prisma.photo.findMany({ where: { groupID, userID: member.id, deletedAt: null }, select: { photoID: true } });
  const ownIDs = ownPhotos.slice(0, 2).map(p => p.photoID);
  await zip(await POST(request(member.token, { ...body, expectedCount: 2, selection: { mode: "ids", ids: ownIDs, excluded: [] } })), 2, "member-own");
  const foreign = await prisma.photo.findFirstOrThrow({ where: { groupID, userID: { not: member.id }, deletedAt: null } });
  await error(await POST(request(member.token, { ...body, expectedCount: 1, selection: { mode: "ids", ids: [foreign.photoID], excluded: [] } })), 400, "NO_PHOTOS");
  await error(await POST(request(member.token, { ...body, expectedCount: 3, selection: { mode: "ids", ids: [...ownIDs, foreign.photoID], excluded: [] } })), 409, "SCOPE_CHANGED");
  const filtered = { ...body, filters: { tz: "Asia/Shanghai", userID: member.id }, expectedCount: ownPhotos.length - 1,
    selection: { mode: "all", ids: [], excluded: [ownIDs[0]] } };
  await zip(await POST(request(owner.token, filtered)), ownPhotos.length - 1, "filtered-excluded");
  await error(await POST(request(owner.token, { ...body, expectedCount: 13 })), 409, "SCOPE_CHANGED");
  await error(await POST(request(owner.token, { ...body, filters: { tz: "invalid/zone" } })), 400, "INVALID_FILTER");
  await error(await POST(request(owner.token, { ...body, groupBy: ["member"] })), 400, "INVALID_REQUEST");
  changed = await prisma.photo.findUniqueOrThrow({ where: { photoID: body.selection.ids[0] }, select: { photoID: true, smallURL: true, largeURL: true } });
  await prisma.photo.update({ where: { photoID: changed.photoID }, data: { largeURL: null, smallURL: null } });
  await error(await POST(request(owner.token)), 502, "FILE_UNAVAILABLE");
  const large = await open(largeFixturePath, "w");
  try { await large.truncate(100 * 1024 * 1024 + 1); } finally { await large.close(); }
  await prisma.photo.update({ where: { photoID: changed.photoID }, data: { largeURL: `/workspace-demo/${largeFixture}` } });
  await error(await POST(request(owner.token, { ...body, expectedCount: 1,
    selection: { mode: "ids", ids: [changed.photoID], excluded: [] } })), 400, "DIRECT_EXPORT_SIZE_LIMIT");
  await prisma.photo.update({ where: { photoID: changed.photoID }, data: { largeURL: changed.largeURL, smallURL: changed.smallURL } });
  changed = undefined;
  const perfTeam = await prisma.team.findUniqueOrThrow({ where: { groupID: "local-share-perf-10000" } });
  const perfOwner = await prisma.user.findUniqueOrThrow({ where: { id: perfTeam.ownerID } });
  assert.ok(perfOwner.email);
  const perf = await tokenFor(perfOwner.email);
  await error(await POST(request(perf.token, { ...body, groupID: perfTeam.groupID, expectedCount: 10000,
    selection: { mode: "all", ids: [], excluded: [] } })), 400, "DIRECT_EXPORT_LIMIT");
  console.log("PASS: member authorization, filtered all-minus selection, stale selection, invalid inputs, unavailable media, 200-file and 100-MB limits");

  // Exercise the actual Next HTTP route too (requires the local dev server).
  const req = request(owner.token);
  await zip(await fetch(req), 12, "http");
  const workspace = await fetch(`http://127.0.0.1:3000/api/workspace?groupID=${groupID}`, { headers: { Authorization: `Bearer ${owner.token}` } });
  assert.equal((await workspace.json()).backgroundExports, process.env.WORKSPACE_BACKGROUND_EXPORTS === "1");
  console.log("PASS: real HTTP download and workspace capability flag");
} finally {
  prisma.workspaceExport.findMany = originalFind;
  prisma.workspaceExport.count = originalCount;
  if (changed) await prisma.photo.update({ where: { photoID: changed.photoID }, data: { largeURL: changed.largeURL, smallURL: changed.smallURL } });
  await prisma.session.deleteMany({ where: { token: { in: sessions } } });
  await prisma.$disconnect();
  await rm(directory, { recursive: true, force: true });
  await rm(largeFixturePath, { force: true });
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });
