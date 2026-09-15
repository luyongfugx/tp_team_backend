import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { copiedPhotoID } from "../lib/web/copy-photos";
import { verifiedShareAttribution } from "../lib/web/share-attribution";
const dbURL = new URL(process.env.DATABASE_URL || "");
if (
  !["localhost", "127.0.0.1"].includes(dbURL.hostname) ||
  dbURL.pathname !== "/tp_team_backend_local"
)
  throw Error("Local test database only");
const db = new PrismaClient(),
  base = "http://127.0.0.1:3000",
  prefix = "share-review-" + randomUUID();
const ownerID = prefix + "-owner",
  memberID = prefix + "-member",
  otherID = prefix + "-other",
  groupID = prefix + "-team",
  foreignID = prefix + "-foreign";
const token = randomUUID(),
  memberToken = randomUUID();
async function post(path: string, body: unknown, auth: string = token) {
  return fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
async function run() {
  await db.user.createMany({
    data: [
      {
        id: ownerID,
        email: ownerID + "@example.invalid",
        userName: "分享管理员",
      },
      {
        id: memberID,
        email: memberID + "@example.invalid",
        userName: "拍摄成员",
      },
      { id: otherID, email: otherID + "@example.invalid" },
    ],
  });
  await db.session.createMany({
    data: [
      { userId: ownerID, token, expiresAt: new Date("9999-12-31") },
      {
        userId: memberID,
        token: memberToken,
        expiresAt: new Date("9999-12-31"),
      },
    ],
  });
  await db.team.create({
    data: {
      groupID,
      groupName: "测试团队",
      ownerID,
      members: {
        create: [
          { userID: ownerID, role: "OWNER" },
          { userID: memberID, role: "MEMBER" },
        ],
      },
    },
  });
  await db.team.create({
    data: { groupID: foreignID, groupName: "其他团队", ownerID: otherID },
  });
  const target = await db.project.create({
      data: { groupID, projectName: "目标项目" },
    }),
    foreign = await db.project.create({
      data: { groupID: foreignID, projectName: "无权项目" },
    });
  await db.photo.createMany({
    data: Array.from({ length: 55 }, (_, i) => ({
      photoID: prefix + "-" + i,
      groupID,
      userID: memberID,
      timestamp: BigInt(Date.UTC(2026, 8, 14, 8)),
      takePhotoFormatTime: "2026-09-14 16:00",
      takePhotoTimezoneID: "Asia/Shanghai",
      ossFileName: prefix + "-" + i + ".jpg",
      largeURL: "/workspace-demo/site-1.svg",
      smallURL: "/workspace-demo/site-1.svg",
      localPhotoName: "测试.jpg",
      lat: 31.2,
      lng: 121.4,
      userName: "拍摄成员",
      location: "原拍摄地点",
      watermarkInfo: { text: "不可改写的水印" },
      mediaType: 0,
    })),
  });
  const scope = { kind: "team", id: groupID },
    body = {
      scope,
      ids: [prefix + "-0"],
      expectedCount: 1,
      projectID: target.projectID,
    };
  assert.equal((await post("/api/web/photos/copy", body, "")).status, 401);
  assert.equal(
    (await post("/api/web/photos/copy", body, memberToken)).status,
    403,
  );
  assert.equal(
    (
      await post("/api/web/photos/copy", {
        ...body,
        projectID: foreign.projectID,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await post("/api/web/photos/copy", {
        ...body,
        scope: { kind: "team", id: foreignID },
      })
    ).status,
    400,
  );
  assert.equal(
    (await post("/api/web/photos/copy", { ...body, expectedCount: 2 })).status,
    400,
  );
  const original = await db.photo.findUniqueOrThrow({
    where: { photoID: prefix + "-0" },
  });
  for (let i = 0; i < 2; i++) {
    const r = await post("/api/web/photos/copy", body);
    assert.equal(r.status, 200, await r.clone().text());
    const result = await r.json();
    assert.equal(result.copied, i === 0 ? 1 : 0);
  }
  const copy = await db.photo.findFirstOrThrow({
    where: { projectID: target.projectID, ossFileName: original.ossFileName },
  });
  for (const key of [
    "timestamp",
    "userID",
    "location",
    "largeURL",
    "smallURL",
    "takePhotoTimezoneID",
    "watermarkInfo",
  ] as const)
    assert.deepEqual(copy[key], original[key], key);
  assert.equal(copy.projectID, target.projectID);
  assert.equal(original.projectID, null);
  await db.photo.update({
    where: { photoID: copy.photoID },
    data: { deletedAt: new Date() },
  });
  assert.equal((await post("/api/web/photos/copy", body)).status, 200);
  assert.equal(
    await db.photo.count({
      where: { projectID: target.projectID, deletedAt: null },
    }),
    1,
  );
  const concurrent = await Promise.all([
    post("/api/web/photos/copy", { ...body, ids: [prefix + "-1"] }),
    post("/api/web/photos/copy", { ...body, ids: [prefix + "-1"] }),
  ]);
  for (const r of concurrent)
    assert.equal(r.status, 200, await r.clone().text());
  assert.equal(
    await db.photo.count({
      where: {
        projectID: target.projectID,
        deletedAt: null,
        ossFileName: prefix + "-1.jpg",
      },
    }),
    1,
  );

  const list = await post("/api/web/photos/list", { scope, mode: "map" }, "");
  assert.equal(list.status, 200, await list.clone().text());
  const map = await list.json();
  assert.equal(map.total, 57);
  assert.equal(map.points.length, 1);
  assert.equal(map.points[0].count, 57);
  assert.ok(!JSON.stringify(map).includes("thumbnailURL"));
  const loc = await (
    await post(
      "/api/web/photos/list",
      { scope, mode: "location", lat: 31.2, lng: 121.4, page: 2 },
      "",
    )
  ).json();
  assert.equal(loc.total, 57);
  assert.equal(loc.photos.length, 9);
  assert.equal(
    (
      await post(
        "/api/web/photos/list",
        { scope, mode: "location", lat: "31.2", lng: 121.4 },
        "",
      )
    ).status,
    400,
  );
  const shared = await post("/api/web/photos/share", {
    scope: { kind: "user", id: memberID },
    groupID,
    locale: "zh-Hans",
  });
  assert.equal(shared.status, 200, await shared.clone().text());
  const link = new URL((await shared.json()).url, base);
  const key = link.searchParams.get("shareKey")!;
  assert.equal(
    await verifiedShareAttribution(key, { kind: "user", id: memberID }),
    "分享管理员",
  );
  assert.equal(
    await verifiedShareAttribution(key, { kind: "user", id: ownerID }),
    undefined,
  );
  const page = await (await fetch(link)).text();
  assert.ok(page.includes("分享管理员"));
  assert.ok(page.includes("工作区"));
  assert.equal(
    (
      await post("/api/web/photos/share", {
        scope: { kind: "team", id: foreignID },
        groupID,
      })
    ).status,
    403,
  );
  console.log(
    "Copy: auth, source/destination permissions, counts, idempotence and capture metadata passed. Map: all filtered photos, lightweight groups and location paging passed. Share attribution: verified sender and scope binding passed.",
  );
}
async function main() {
  try {
    await run();
  } finally {
    await db.team.deleteMany({
      where: { groupID: { in: [groupID, foreignID] } },
    });
    await db.session.deleteMany({
      where: { userId: { in: [ownerID, memberID, otherID] } },
    });
    await db.user.deleteMany({
      where: { id: { in: [ownerID, memberID, otherID] } },
    });
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
