import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const url = new URL(process.env.DATABASE_URL || "");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.pathname !== "/tp_team_backend_local"
)
  throw Error("Local test database only");
const db = new PrismaClient(),
  id = "local-share-perf-10000",
  userID = "local-share-perf-user",
  base = "http://127.0.0.1:3000";
async function main() {
  await db.user.upsert({
    where: { id: userID },
    update: {},
    create: {
      id: userID,
      email: "share-perf@example.invalid",
      userName: "性能测试员",
    },
  });
  await db.team.upsert({
    where: { groupID: id },
    update: {},
    create: {
      groupID: id,
      groupName: "一万张照片 · 性能测试",
      ownerID: userID,
      members: { create: { userID, role: "OWNER", roleID: 1 } },
    },
  });
  let project = await db.project.findFirst({ where: { groupID: id } });
  if (!project)
    project = await db.project.create({
      data: { groupID: id, projectName: "大图库测试项目" },
    });
  if ((await db.photo.count({ where: { groupID: id } })) < 10000) {
    for (let start = 0; start < 10000; start += 500)
      await db.photo.createMany({
        skipDuplicates: true,
        data: Array.from({ length: 500 }, (_, j) => {
          const n = start + j;
          return {
            photoID: `perf-photo-${String(n).padStart(5, "0")}`,
            groupID: id,
            projectID: project!.projectID,
            userID,
            timestamp: BigInt(Date.UTC(2026, 8, 14, 6) - n * 60000),
            takePhotoFormatTime: "2026-09-14 14:00:00",
            takePhotoTimezoneID: n % 10 === 0 ? "UTC" : "Asia/Shanghai",
            smallURL: `/workspace-demo/site-${n % 12}.svg`,
            largeURL: `/workspace-demo/site-${n % 12}.svg`,
            ossFileName: `perf-${n}`,
            localPhotoName: `测试照片-${String(n).padStart(5, "0")}.svg`,
            userName: "性能测试员",
            projectName: project!.projectName,
            location: n % 2 ? "工地 A" : "工地 B",
            lat: 31.2304 + (n % 48) * 0.0001,
            lng: 121.4737,
            mediaType: 0,
          };
        }),
      });
  }
  const scopes = [
    { kind: "team", id },
    { kind: "project", id: String(project.projectID) },
    { kind: "user", id: userID },
  ];
  const post = async (body: unknown) => {
    const start = performance.now();
    const r = await fetch(base + "/api/web/photos/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    assert.equal(r.status, 200, text);
    return {
      ...JSON.parse(text),
      ms: Math.round(performance.now() - start),
      bytes: Buffer.byteLength(text),
    };
  };
  const results = [];
  for (const scope of scopes) {
    await post({ scope, page: 1, locale: "zh-Hans" }); // warm compilation and connection pool
    for (const page of [1, 2, 100, 209]) {
      const r = await post({ scope, page, locale: "zh-Hans" });
      assert.equal(r.total, 10000);
      assert.ok(r.photos.length <= 48);
      results.push({
        scope: scope.kind,
        page,
        ms: r.ms,
        bytes: r.bytes,
        rows: r.photos.length,
      });
    }
  }
  const first = await post({ scope: scopes[0], page: 1, locale: "zh-Hans" });
  const second = await post({
    scope: scopes[0],
    page: 2,
    locale: "zh-Hans",
    snapshot: first.snapshot,
  });
  assert.ok(
    second.photos.every(
      (p: any) => !first.photos.some((f: any) => f.photoID === p.photoID),
    ),
  );
  const filtered = await post({
    scope: scopes[0],
    filters: { q: "工地 A", from: "2026-09-14", to: "2026-09-14" },
    locale: "zh-Hans",
  });
  assert.ok(
    filtered.photos.every(
      (p: any) => p.location === "工地 A" && p.dateKey === "2026-09-14",
    ),
  );
  const bounded = await fetch(base + "/api/web/photos/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: scopes[0],
      all: true,
      excluded: [],
      format: "zip",
      snapshot: first.snapshot,
    }),
  });
  assert.equal(bounded.status, 400);
  const selection = await post({
    scope: scopes[0],
    mode: "selection",
    ids: [first.photos[0].photoID, second.photos[0].photoID],
    snapshot: first.snapshot,
    locale: "zh-Hans",
  });
  assert.equal(selection.photos.length, 2);
  const report = {
    generated: new Date().toISOString(),
    mode: "local Next.js development server, warmed requests",
    results,
    filter: { ms: filtered.ms, total: filtered.total, bytes: filtered.bytes },
    checks: [
      "3 scopes each capped at 48",
      "pages do not overlap",
      "capture-timezone date filter",
      "selection across pages",
      "large all-selection export bounded",
    ],
  };
  await writeFile(
    ".local/share-performance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
main().finally(() => db.$disconnect());
