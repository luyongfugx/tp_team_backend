import { randomUUID } from "node:crypto";
import { createWriteStream, type WriteStream } from "node:fs";
import { mkdir, rm, rename, stat, readdir } from "node:fs/promises";
import path from "node:path";
import { pipeline, finished } from "node:stream/promises";
import { ZipArchive } from "archiver";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { accessFor, photoWhere } from "../lib/workspace/server";
import { checkJobPhotos } from "../lib/workspace/exports";
import {
  sourceFile,
  sizeLimit,
  safeName,
  exportRoot,
} from "../lib/workspace/files";
import { dateKey } from "../lib/workspace/model";

const LEASE_MS = 120000;
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runOne() {
  const now = new Date();
  const job = await prisma.workspaceExport.findFirst({
    where: {
      OR: [
        { status: "QUEUED" },
        { status: "RUNNING", leaseUntil: { lt: now } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!job) return false;
  const token = randomUUID();
  const claim = await prisma.workspaceExport.updateMany({
    where: {
      id: job.id,
      status: job.status,
      leaseToken: job.leaseToken,
      ...(job.status === "RUNNING" ? { leaseUntil: { lt: now } } : {}),
    },
    data: {
      status: "RUNNING",
      leaseToken: token,
      leaseUntil: new Date(Date.now() + LEASE_MS),
      attempts: { increment: 1 },
      processed: 0,
      succeeded: 0,
      failures: Prisma.DbNull,
      error: null,
    },
  });
  if (!claim.count) return true;
  const owned = { id: job.id, leaseToken: token, status: "RUNNING" };
  const root = exportRoot(),
    scratch = path.join(root, `${job.id}-${token}`),
    finalName = `${job.id}-${token}.zip`,
    partial = path.join(scratch, "archive.zip");
  let published = false,
    archive: ZipArchive | undefined,
    output: WriteStream | undefined;
  const abort = new AbortController();
  let heartbeatBusy = false;
  const heartbeat = setInterval(async () => {
    if (heartbeatBusy) return;
    heartbeatBusy = true;
    try {
      const updated = await prisma.workspaceExport.updateMany({
        where: owned,
        data: { leaseUntil: new Date(Date.now() + LEASE_MS) },
      });
      if (!updated.count) abort.abort();
    } catch {
      abort.abort();
    } finally {
      heartbeatBusy = false;
    }
  }, 15000);
  try {
    if (job.attempts >= 3) throw new Error("WORKER_INTERRUPTED");
    await checkJobPhotos(job);
    await mkdir(scratch, { recursive: true, mode: 0o700 });
    archive = new ZipArchive({ store: true });
    output = createWriteStream(partial, { mode: 0o600 });
    output.on("error", () => abort.abort());
    const outputDone = finished(output);
    outputDone.catch(() => {});
    archive.on("error", (error) => output?.destroy(error));
    archive.on("warning", (error) => output?.destroy(error));
    archive.pipe(output);
    const failures: { photoID: string; reason: string }[] = [];
    let succeeded = 0,
      processed = 0,
      totalBytes = 0;
    const entries: { photoID: string; file: string }[] = [];
    for (const id of job.photoIDs as string[]) {
      if (stopping || abort.signal.aborted)
        throw new Error("WORKER_INTERRUPTED");
      // Check deletion and current role again while long-running jobs are processed.
      const access = await accessFor(job.groupID, job.userID);
      const photo = await prisma.photo.findFirst({
        where: { AND: [photoWhere(access), { photoID: id }] },
        include: {
          project: { select: { projectName: true } },
          user: { select: { userName: true } },
        },
      });
      if (!photo) throw new Error("SCOPE_CHANGED");
      const temp = path.join(scratch, `${processed}.media`);
      try {
        const file = await sourceFile(
          photo.largeURL || photo.smallURL,
          abort.signal,
        );
        await pipeline(
          file.stream,
          sizeLimit(250 * 1024 * 1024),
          createWriteStream(temp, { mode: 0o600 }),
          { signal: abort.signal },
        );
        const bytes = (await stat(temp)).size;
        totalBytes += bytes;
        if (totalBytes > 2 * 1024 * 1024 * 1024)
          throw new Error("EXPORT_SIZE_LIMIT");
        const folder = safeName(
          job.groupBy === "project"
            ? photo.project?.projectName || photo.projectName || "No project"
            : job.groupBy === "member"
              ? photo.userName || photo.user.userName || photo.userID
              : dateKey(Number(photo.timestamp), job.timeZone),
        );
        const name = `${folder}/${String(processed + 1).padStart(4, "0")}_${safeName((photo.localPhotoName || id).replace(/\.[^.]+$/, ""))}${file.extension}`;
        archive.file(temp, { name, date: new Date(Number(photo.timestamp)) });
        entries.push({ photoID: id, file: name });
        succeeded++;
      } catch (e) {
        // A failed/oversize download may have filled its temporary file. Do not
        // accumulate up to 2,000 partial files outside the successful-byte limit.
        await rm(temp, { force: true });
        if (e instanceof Error && e.message === "EXPORT_SIZE_LIMIT") throw e;
        failures.push({
          photoID: id,
          reason:
            e instanceof Error &&
            ["FILE_TOO_LARGE", "STORAGE_NOT_CONFIGURED"].includes(e.message)
              ? e.message
              : "FILE_UNAVAILABLE",
        });
      }
      processed++;
      const update = await prisma.workspaceExport.updateMany({
        where: owned,
        data: {
          processed,
          succeeded,
          failures,
          leaseUntil: new Date(Date.now() + LEASE_MS),
        },
      });
      if (!update.count) throw new Error("WORKER_INTERRUPTED");
    }
    if (!succeeded) throw new Error(failures[0]?.reason || "FILE_UNAVAILABLE");
    archive.append(
      JSON.stringify(
        {
          title: job.title,
          timeZone: job.timeZone,
          total: job.total,
          succeeded,
          failures,
          files: entries,
        },
        null,
        2,
      ),
      { name: "manifest.json" },
    );
    await archive.finalize();
    await outputDone;
    await checkJobPhotos(job);
    await rename(partial, path.join(root, finalName));
    const completed = await prisma.workspaceExport.updateMany({
      where: owned,
      data: {
        status: failures.length ? "PARTIAL" : "COMPLETED",
        filePath: finalName,
        leaseUntil: null,
        leaseToken: null,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    published = completed.count > 0;
  } catch (e) {
    archive?.abort();
    const code = e instanceof Error ? e.message : "EXPORT_FAILED";
    await prisma.workspaceExport.updateMany({
      where: owned,
      data: {
        status:
          code === "WORKER_INTERRUPTED" && job.attempts < 3
            ? "QUEUED"
            : "FAILED",
        error: [
          "SCOPE_CHANGED",
          "FILE_UNAVAILABLE",
          "STORAGE_NOT_CONFIGURED",
          "FILE_TOO_LARGE",
          "EXPORT_SIZE_LIMIT",
          "WORKER_INTERRUPTED",
        ].includes(code)
          ? code
          : "EXPORT_FAILED",
        leaseToken: null,
        leaseUntil: null,
      },
    });
  } finally {
    clearInterval(heartbeat);
    abort.abort();
    output?.destroy();
    await rm(scratch, { recursive: true, force: true });
    if (!published) await rm(path.join(root, finalName), { force: true });
  }
  return true;
}
async function cleanExpired() {
  const expired = await prisma.workspaceExport.findMany({
    where: {
      status: { in: ["COMPLETED", "PARTIAL"] },
      expiresAt: { lt: new Date() },
    },
    take: 100,
  });
  for (const job of expired) {
    if (job.filePath)
      await rm(path.join(exportRoot(), path.basename(job.filePath)), {
        force: true,
      });
    await prisma.workspaceExport.update({
      where: { id: job.id },
      data: { status: "EXPIRED", filePath: null },
    });
  }
  // Clean interrupted-worker scratch files after their lease has long expired.
  for (const entry of await readdir(exportRoot(), {
    withFileTypes: true,
  }).catch(() => [])) {
    const file = path.join(exportRoot(), entry.name);
    if (Date.now() - (await stat(file)).mtimeMs > 8 * 86400000)
      await rm(file, { recursive: true, force: true });
  }
}
async function main() {
  await mkdir(exportRoot(), { recursive: true, mode: 0o700 });
  console.log("Timeprint export worker ready");
  let lastCleanup = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastCleanup > 3600000) {
        await cleanExpired();
        lastCleanup = Date.now();
      }
      if (!(await runOne())) await pause(2000);
    } catch (e) {
      console.error(
        "Export worker retry:",
        e instanceof Error ? e.message : "failure",
      );
      await pause(5000);
    }
  }
  await prisma.$disconnect();
}
main().catch(() => process.exit(1));
