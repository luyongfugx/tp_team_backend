import type { Prisma, WorkspaceExport } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { accessFor, photoWhere, WorkspaceError } from "./server";
export function publicJob(j: WorkspaceExport) {
  return {
    id: j.id,
    title: j.title,
    status: j.status,
    total: j.total,
    processed: j.processed,
    succeeded: j.succeeded,
    failures: j.failures,
    error: j.error,
    createdAt: j.createdAt,
    expiresAt: j.expiresAt,
    groupBy: j.groupBy,
    timeZone: j.timeZone,
  };
}
export async function ownedJob(id: string, userID: string) {
  const job = await prisma.workspaceExport.findFirst({ where: { id, userID } });
  if (!job) throw new WorkspaceError("FILE_UNAVAILABLE", 404);
  await accessFor(job.groupID, userID);
  return job;
}
export async function checkJobPhotos(job: WorkspaceExport) {
  const access = await accessFor(job.groupID, job.userID);
  const ids = job.photoIDs as string[];
  const count = await prisma.photo.count({
    where: { AND: [photoWhere(access), { photoID: { in: ids } }] },
  });
  if (count !== ids.length) throw new WorkspaceError("SCOPE_CHANGED", 403);
  return access;
}

// Serialize enqueue operations per account so concurrent requests cannot exceed the active-job limit.
export async function enqueueExport(data: Prisma.WorkspaceExportCreateInput) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM User WHERE id = ${data.userID} FOR UPDATE`;
    const active = await tx.workspaceExport.count({
      where: { userID: data.userID, status: { in: ["QUEUED", "RUNNING"] } },
    });
    if (active >= 3) throw new WorkspaceError("TOO_MANY_EXPORTS", 429);
    return tx.workspaceExport.create({ data });
  });
}
