// Local-only end-to-end API regression. Start Next and worker:exports, then seed-workspace-demo.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { PrismaClient, Prisma } from "@prisma/client";
const database = new URL(process.env.DATABASE_URL || "");
if (
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  database.pathname !== "/tp_team_backend_local"
)
  throw new Error("Local fixture database required");
const db = new PrismaClient(),
  groupID = "local-workspace-demo",
  base = "http://127.0.0.1:3000";
const sessions: string[] = [],
  jobs: string[] = [];
let brokenID = "";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function tokenFor(email: string) {
  const user = await db.user.findUniqueOrThrow({ where: { email } }),
    token = randomBytes(32).toString("hex");
  await db.session.create({
    data: { token, userId: user.id, expiresAt: new Date("9999-12-31") },
  });
  sessions.push(token);
  return { token, id: user.id };
}
async function call(token: string, path: string, body?: unknown) {
  return fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function waitJob(id: string) {
  for (let n = 0; n < 120; n++) {
    const job = await db.workspaceExport.findUniqueOrThrow({ where: { id } });
    if (!["QUEUED", "RUNNING"].includes(job.status)) return job;
    await pause(500);
  }
  throw new Error("Worker did not finish within 60 seconds");
}
async function main() {
  const owner = await tokenFor("local-test@example.com"),
    member = await tokenFor("workspace-demo-lin@example.com");
  const unauth = await fetch(`${base}/api/workspace/photos?groupID=${groupID}`);
  assert.equal(unauth.status, 401);
  assert.equal(
    (await call(member.token, "/api/workspace/photos?groupID=unknown-team"))
      .status,
    403,
  );
  const all = await (
    await call(
      owner.token,
      `/api/workspace/photos?groupID=${groupID}&tz=Asia/Shanghai`,
    )
  ).json();
  assert.equal(all.total, 67);
  assert.equal(all.photos.length, 48);
  assert.equal(all.pages, 2);
  const second = await (
    await call(owner.token, `/api/workspace/photos?groupID=${groupID}&page=2`)
  ).json();
  assert.equal(second.photos.length, 19);
  assert.ok(
    second.photos.every(
      (p: { photoID: string }) =>
        !all.photos.some((x: { photoID: string }) => p.photoID === x.photoID),
    ),
  );
  const own = await (
    await call(member.token, `/api/workspace/photos?groupID=${groupID}`)
  ).json();
  assert.ok(own.total < all.total);
  assert.ok(
    own.photos.every((p: { userID: string }) => p.userID === member.id),
  );
  const forged = await (
    await call(
      member.token,
      `/api/workspace/photos?groupID=${groupID}&userID=${owner.id}`,
    )
  ).json();
  assert.equal(forged.total, 0);
  const foreignID = all.photos.find(
    (p: { userID: string }) => p.userID === owner.id,
  ).photoID;
  assert.equal(
    (
      await call(
        member.token,
        `/api/workspace/photos/download?groupID=${groupID}&photoID=${foreignID}`,
      )
    ).status,
    404,
  );
  const single = await call(
    owner.token,
    `/api/workspace/photos/download?groupID=${groupID}&photoID=${foreignID}`,
  );
  assert.equal(single.status, 200);
  assert.match(await single.text(), /LOCAL DEMO/);
  assert.equal(
    (
      await call(member.token, "/api/workspace/projects", {
        groupID,
        projectName: "forbidden",
      })
    ).status,
    403,
  );
  console.log(
    "PASS: authentication, 48-file pagination, stable ordering, member scope, protected single download, project write authorization",
  );
  const filters = {
    tz: "Asia/Shanghai",
    projectID: String(all.photos[0].projectID),
  };
  const filtered = await (
    await call(
      owner.token,
      `/api/workspace/photos?groupID=${groupID}&${new URLSearchParams(filters)}`,
    )
  ).json();
  const selection = {
    mode: "all",
    ids: [],
    excluded: [filtered.photos[0].photoID],
  };
  const res = await call(owner.token, "/api/workspace/exports", {
    groupID,
    filters,
    selection,
    title: "Integration ZIP",
    groupBy: "date",
  });
  assert.equal(res.status, 201);
  const job = (await res.json()).job;
  jobs.push(job.id);
  assert.equal(job.total, filtered.total - 1);
  const completed = await waitJob(job.id);
  assert.equal(completed.status, "COMPLETED");
  assert.equal(completed.succeeded, job.total);
  assert.equal(
    (await call(member.token, `/api/workspace/exports/${job.id}/download`))
      .status,
    404,
  );
  const archive = await call(
    owner.token,
    `/api/workspace/exports/${job.id}/download`,
  );
  assert.equal(archive.status, 200);
  await mkdir(".local/test-artifacts", { recursive: true });
  await writeFile(
    ".local/test-artifacts/workspace.zip",
    Buffer.from(await archive.arrayBuffer()),
  );
  console.log(
    `PASS: all-filtered selection with exclusion exported ${job.total} files; ZIP artifact saved for content inspection`,
  );
  // An expired lease simulates abrupt process death; a fresh worker must recover the same durable job.
  const recovered = await db.workspaceExport.create({
    data: {
      groupID,
      userID: owner.id,
      title: "Recovery test",
      photoIDs: [foreignID],
      total: 1,
      status: "RUNNING",
      leaseToken: "dead-worker",
      leaseUntil: new Date(0),
      attempts: 1,
    },
  });
  jobs.push(recovered.id);
  const recoveryResult = await waitJob(recovered.id);
  assert.equal(recoveryResult.status, "COMPLETED");
  assert.equal(recoveryResult.attempts, 2);
  const cancelled = await db.workspaceExport.create({
    data: {
      groupID,
      userID: owner.id,
      title: "Cancel test",
      photoIDs: [foreignID],
      total: 1,
      status: "RUNNING",
      leaseToken: "test",
      leaseUntil: new Date(Date.now() + 60000),
    },
  });
  jobs.push(cancelled.id);
  assert.equal(
    (
      await call(owner.token, `/api/workspace/exports/${cancelled.id}`, {
        action: "cancel",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await db.workspaceExport.findUniqueOrThrow({
        where: { id: cancelled.id },
      })
    ).status,
    "CANCELLED",
  );
  console.log(
    "PASS: durable job recovery after expired lease, task ownership, cancellation",
  );
  const original = await db.photo.findUniqueOrThrow({
    where: { photoID: foreignID },
  });
  brokenID = `local-integration-broken-${Date.now()}`;
  await db.photo.create({
    data: {
      photoID: brokenID,
      groupID,
      userID: owner.id,
      projectID: original.projectID,
      timestamp: original.timestamp,
      takePhotoFormatTime: original.takePhotoFormatTime,
      takePhotoTimezoneID: "UTC",
      largeURL: "/workspace-demo/missing.svg",
      ossFileName: brokenID,
    },
  });
  const partial = await db.workspaceExport.create({
    data: {
      groupID,
      userID: owner.id,
      title: "Partial test",
      photoIDs: [foreignID, brokenID],
      total: 2,
    },
  });
  jobs.push(partial.id);
  const partialResult = await waitJob(partial.id);
  assert.equal(partialResult.status, "PARTIAL");
  assert.equal(partialResult.succeeded, 1);
  assert.equal(
    (partialResult.failures as { photoID: string }[])[0].photoID,
    brokenID,
  );
  const retried = await call(
    owner.token,
    `/api/workspace/exports/${partial.id}`,
    { action: "retry" },
  );
  assert.equal(retried.status, 201);
  const retryJob = (await retried.json()).job;
  jobs.push(retryJob.id);
  assert.equal(retryJob.total, 1);
  assert.equal((await waitJob(retryJob.id)).status, "FAILED");
  // Permission changes after export creation must revoke access to the previously generated file.
  await db.photo.update({
    where: { photoID: foreignID },
    data: { deletedAt: new Date() },
  });
  try {
    assert.equal(
      (
        await call(
          owner.token,
          `/api/workspace/exports/${recovered.id}/download`,
        )
      ).status,
      403,
    );
  } finally {
    await db.photo.update({
      where: { photoID: foreignID },
      data: { deletedAt: null },
    });
  }
  await db.workspaceExport.update({
    where: { id: job.id },
    data: { expiresAt: new Date(0) },
  });
  assert.equal(
    (await call(owner.token, `/api/workspace/exports/${job.id}/download`))
      .status,
    410,
  );
  console.log(
    "PASS: partial failure list, retry failed files only, revoked scope and expired download denial",
  );
}
main()
  .finally(async () => {
    await db.session.deleteMany({ where: { token: { in: sessions } } });
    const records = await db.workspaceExport.findMany({
      where: { id: { in: jobs } },
    });
    for (const row of records)
      if (row.filePath)
        await rm(`.data/workspace-exports/${row.filePath}`, { force: true });
    await db.workspaceExport.deleteMany({ where: { id: { in: jobs } } });
    if (brokenID) await db.photo.deleteMany({ where: { photoID: brokenID } });
    await db.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
