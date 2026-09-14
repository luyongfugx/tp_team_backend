import { prisma } from "@/lib/prisma";
import { readFilters, readSelection } from "@/lib/workspace/model";
import {
  accessFor,
  photoWhere,
  workspaceUser,
  workspaceResponse,
  workspaceFailure,
  WorkspaceError,
  isWorkspaceExportTableMissing,
} from "@/lib/workspace/server";
import { publicJob, enqueueExport } from "@/lib/workspace/exports";
export async function GET(req: Request) {
  try {
    const user = await workspaceUser(req),
      groupID = new URL(req.url).searchParams.get("groupID") || "";
    await accessFor(groupID, user.id);
    const jobs = await prisma.workspaceExport.findMany({
      where: { userID: user.id, groupID },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return workspaceResponse({ jobs: jobs.map(publicJob) });
  } catch (e) {
    if (isWorkspaceExportTableMissing(e)) return workspaceResponse({ jobs: [], backgroundAvailable: false });
    return workspaceFailure(e);
  }
}
export async function POST(req: Request) {
  try {
    const user = await workspaceUser(req),
      body = await req.json();
    const access = await accessFor(
      typeof body.groupID === "string" ? body.groupID : "",
      user.id,
    );
    const filters = readFilters(new URLSearchParams(body.filters)),
      selection = readSelection(body.selection);
    const groupBy = ["date", "project", "member"].includes(body.groupBy)
      ? body.groupBy
      : "date";
    const photos = await prisma.photo.findMany({
      where: photoWhere(access, filters, selection),
      select: { photoID: true },
      orderBy: [{ timestamp: "desc" }, { photoID: "desc" }],
      take: 2001,
    });
    if (!photos.length) throw new WorkspaceError("NO_PHOTOS");
    if (photos.length > 2000) throw new WorkspaceError("EXPORT_LIMIT");
    if (body.expectedCount != null && body.expectedCount !== photos.length)
      throw new WorkspaceError("SCOPE_CHANGED", 409);
    if (selection.mode === "ids" && photos.length !== selection.ids.length)
      throw new WorkspaceError("SCOPE_CHANGED", 409);
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 100)
        : access.team.groupName;
    const job = await enqueueExport({
      userID: user.id,
      groupID: access.team.groupID,
      title,
      photoIDs: photos.map((p) => p.photoID),
      total: photos.length,
      groupBy,
      timeZone: filters.tz,
    });
    return workspaceResponse({ job: publicJob(job) }, 201);
  } catch (e) {
    return workspaceFailure(e);
  }
}
