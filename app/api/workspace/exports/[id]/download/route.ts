import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import {
  workspaceUser,
  workspaceFailure,
  WorkspaceError,
} from "@/lib/workspace/server";
import { ownedJob, checkJobPhotos } from "@/lib/workspace/exports";
import { downloadHeaders, exportRoot } from "@/lib/workspace/files";
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await workspaceUser(req),
      { id } = await context.params,
      job = await ownedJob(id, user.id);
    if (
      !["COMPLETED", "PARTIAL"].includes(job.status) ||
      !job.filePath ||
      !job.expiresAt ||
      job.expiresAt <= new Date()
    )
      throw new WorkspaceError("FILE_EXPIRED", 410);
    await checkJobPhotos(job);
    const file = path.join(exportRoot(), path.basename(job.filePath));
    await stat(file);
    return new Response(
      Readable.toWeb(
        createReadStream(file, { signal: req.signal }),
      ) as ReadableStream,
      { headers: downloadHeaders(`${job.title}.zip`, "application/zip") },
    );
  } catch (e) {
    return workspaceFailure(e);
  }
}
