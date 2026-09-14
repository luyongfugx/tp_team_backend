import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/app/api/_utils/api";
import { isSuperAdmin } from "@/app/api/_utils/admin";
import { resolvePhotoURL, thumbnailPhotoURL } from "@/app/web/photo-url";
import { dateBoundary, type PhotoFilters, type Selection } from "./model";

export class WorkspaceError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export async function workspaceUser(req: Request) {
  const user = await requireUser(req);
  if (!user) throw new WorkspaceError("UNAUTHORIZED", 401);
  return user;
}
export async function accessFor(groupID: string, userID: string) {
  const [team, user] = await Promise.all([
    prisma.team.findFirst({
      where: { groupID, deletedAt: null },
      select: {
        groupID: true,
        groupName: true,
        ownerID: true,
        members: { where: { userID }, select: { role: true } },
      },
    }),
    prisma.user.findFirst({
      where: { id: userID, deletedAt: null },
      select: { id: true, email: true },
    }),
  ]);
  if (
    !team ||
    !user ||
    (!team.members.length && team.ownerID !== userID && !isSuperAdmin(user))
  )
    throw new WorkspaceError("FORBIDDEN", 403);
  const canManage =
    isSuperAdmin(user) ||
    team.ownerID === userID ||
    ["OWNER", "ADMIN"].includes(team.members[0]?.role || "");
  return {
    team: { groupID: team.groupID, groupName: team.groupName },
    userID,
    canManage,
  };
}
export type WorkspaceAccess = Awaited<ReturnType<typeof accessFor>>;
export function photoWhere(
  access: WorkspaceAccess,
  f?: PhotoFilters,
  selection?: Selection,
): Prisma.PhotoWhereInput {
  const and: Prisma.PhotoWhereInput[] = [
    { groupID: access.team.groupID, deletedAt: null },
    { OR: [{ projectID: null }, { project: { deletedAt: null } }] },
  ];
  if (!access.canManage) and.push({ userID: access.userID });
  if (f) {
    if (f.projectID) and.push({ projectID: Number(f.projectID) });
    if (f.userID) and.push({ userID: f.userID });
    if (f.type) and.push({ mediaType: Number(f.type) });
    if (f.from || f.to)
      and.push({
        timestamp: {
          ...(f.from ? { gte: BigInt(dateBoundary(f.from, f.tz)) } : {}),
          ...(f.to ? { lt: BigInt(dateBoundary(f.to, f.tz, true)) } : {}),
        },
      });
    if (f.q.trim())
      and.push({
        OR: [
          "localPhotoName",
          "location",
          "userName",
          "projectName",
          "antiFakeCode",
          "searchText",
        ].map((k) => ({ [k]: { contains: f.q.trim() } })),
      });
  }
  if (selection)
    and.push({
      photoID:
        selection.mode === "ids"
          ? { in: selection.ids }
          : { notIn: selection.excluded },
    });
  return { AND: and };
}
export const photoFields = {
  photoID: true,
  groupID: true,
  projectID: true,
  userID: true,
  timestamp: true,
  mediaType: true,
  duration: true,
  smallURL: true,
  largeURL: true,
  localPhotoName: true,
  userName: true,
  projectName: true,
  location: true,
  lat: true,
  lng: true,
  takePhotoTimezoneID: true,
  antiFakeCode: true,
  systemInfo: true,
  user: { select: { userName: true, email: true } },
  project: { select: { projectName: true } },
} satisfies Prisma.PhotoSelect;
export function mapPhoto(
  p: Prisma.PhotoGetPayload<{ select: typeof photoFields }>,
) {
  const system = (
    p.systemInfo &&
    typeof p.systemInfo === "object" &&
    !Array.isArray(p.systemInfo)
      ? p.systemInfo
      : {}
  ) as Record<string, unknown>;
  const text = (...keys: string[]) =>
    keys.map((k) => system[k]).find((v) => typeof v === "string" && v) as
      string | undefined;
  const imageURL = resolvePhotoURL(p.largeURL || p.smallURL);
  return {
    photoID: p.photoID,
    projectID: p.projectID,
    userID: p.userID,
    timestamp: Number(p.timestamp),
    mediaType: p.mediaType,
    duration: p.duration,
    imageURL,
    thumbnailURL:
      resolvePhotoURL(p.smallURL) ||
      (p.mediaType === 0 ? thumbnailPhotoURL(imageURL) : null),
    localPhotoName: p.localPhotoName,
    userName: p.userName || p.user.userName || p.user.email,
    projectName: p.project?.projectName || p.projectName,
    location: p.location,
    lat: p.lat == null ? null : Number(p.lat),
    lng: p.lng == null ? null : Number(p.lng),
    timeZone: p.takePhotoTimezoneID,
    photoCode: p.antiFakeCode,
    device: text("deviceModel", "model") || null,
    os: text("os", "systemVersion") || null,
  };
}
export function workspaceResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function workspaceFailure(error: unknown) {
  if (isWorkspaceExportTableMissing(error))
    return workspaceResponse({ error: "EXPORT_SERVICE_UNAVAILABLE" }, 503);
  if (error instanceof WorkspaceError)
    return workspaceResponse({ error: error.code }, error.status);
  if (error instanceof Error && /^INVALID_/.test(error.message))
    return workspaceResponse({ error: error.message }, 400);
  if (
    error instanceof Error &&
    ["FILE_UNAVAILABLE", "STORAGE_NOT_CONFIGURED", "FILE_TOO_LARGE"].includes(
      error.message,
    )
  )
    return workspaceResponse({ error: error.message }, 502);
  console.error(
    "[workspace]",
    error instanceof Error ? error.message : "Unexpected failure",
  );
  return workspaceResponse({ error: "SERVER_ERROR" }, 500);
}

export function isWorkspaceExportTableMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021" &&
    (error.meta?.modelName === "WorkspaceExport" || String(error.meta?.table || "").includes("WorkspaceExport"));
}
