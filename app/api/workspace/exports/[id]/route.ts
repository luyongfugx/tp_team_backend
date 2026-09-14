import { prisma } from "@/lib/prisma";
import {
  workspaceUser,
  workspaceResponse,
  workspaceFailure,
  WorkspaceError,
} from "@/lib/workspace/server";
import {
  ownedJob,
  checkJobPhotos,
  publicJob,
  enqueueExport,
} from "@/lib/workspace/exports";
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await workspaceUser(req),
      { id } = await context.params,
      body = await req.json();
    const job = await ownedJob(id, user.id);
    if (body.action === "cancel") {
      await prisma.workspaceExport.updateMany({
        where: { id, status: { in: ["QUEUED", "RUNNING"] } },
        data: { status: "CANCELLED", leaseToken: null, leaseUntil: null },
      });
      return workspaceResponse({ ok: true });
    }
    if (
      body.action === "retry" &&
      ["FAILED", "PARTIAL", "CANCELLED", "EXPIRED"].includes(job.status)
    ) {
      await checkJobPhotos(job);
      const ids =
        job.status === "PARTIAL" && Array.isArray(job.failures)
          ? job.failures.map((f) => (f as { photoID: string }).photoID)
          : (job.photoIDs as string[]);
      const retried = await enqueueExport({
        userID: user.id,
        groupID: job.groupID,
        title: job.title,
        groupBy: job.groupBy,
        timeZone: job.timeZone,
        photoIDs: ids,
        total: ids.length,
      });
      return workspaceResponse({ job: publicJob(retried) }, 201);
    }
    throw new WorkspaceError("INVALID_ACTION");
  } catch (e) {
    return workspaceFailure(e);
  }
}
