import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/app/api/_utils/admin";
import {
  workspaceUser,
  workspaceResponse,
  workspaceFailure,
  WorkspaceError,
} from "@/lib/workspace/server";
import { readGalleryScope, publicPhotoWhere } from "@/lib/web/public-scope";
import { readPublicRequest } from "@/lib/web/request";
import { resolveGallerySelection } from "@/lib/web/query";
import { copyPhotoData, copiedPhotoID } from "@/lib/web/copy-photos";

export async function GET(req: Request) {
  try {
    const user = await workspaceUser(req),
      q = new URL(req.url).searchParams;
    const scope = readGalleryScope({ kind: q.get("kind"), id: q.get("id") });
    const teams = await prisma.team.findMany({
      where: {
        deletedAt: null,
        ...(!isSuperAdmin(user)
          ? {
              OR: [
                { ownerID: user.id },
                {
                  members: {
                    some: { userID: user.id, role: { in: ["OWNER", "ADMIN"] } },
                  },
                },
              ],
            }
          : {}),
      },
      select: { groupID: true, groupName: true },
      orderBy: { groupName: "asc" },
    });
    const allowed = await prisma.photo.count({
      where: {
        AND: [
          publicPhotoWhere(scope),
          { groupID: { in: teams.map((t) => t.groupID) } },
        ],
      },
    });
    const projects = allowed
      ? await prisma.project.findMany({
          where: {
            groupID: { in: teams.map((t) => t.groupID) },
            deletedAt: null,
          },
          select: { projectID: true, projectName: true, groupID: true },
          orderBy: { projectName: "asc" },
        })
      : [];
    return workspaceResponse({ teams: allowed ? teams : [], projects });
  } catch (e) {
    return workspaceFailure(e);
  }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin)
      throw new WorkspaceError("FORBIDDEN", 403);
    const user = await workspaceUser(req),
      body = await readPublicRequest(req);
    if (!Number.isSafeInteger(body.projectID) || Number(body.projectID) <= 0)
      throw new WorkspaceError("INVALID_PROJECT");
    const scope = readGalleryScope(body.scope);
    const where = await resolveGallerySelection({ ...body, scope }, 200);
    const result = await prisma.$transaction(
      async (tx) => {
        // Serialize writes to one destination so retries cannot create duplicate assets.
        await tx.$queryRaw`SELECT projectID FROM Project WHERE projectID = ${Number(body.projectID)} FOR UPDATE`;
        const rows = await tx.photo.findMany({ where, take: 201 });
        if (
          !rows.length ||
          rows.length > 200 ||
          rows.length !== body.expectedCount
        )
          throw new WorkspaceError("PHOTOS_UNAVAILABLE", 409);
        const target = await tx.project.findFirst({
          where: { projectID: Number(body.projectID), deletedAt: null },
          select: { projectID: true, projectName: true, groupID: true },
        });
        if (!target) throw new WorkspaceError("INVALID_PROJECT");
        const groupIDs = [
          ...new Set([...rows.map((p) => p.groupID), target.groupID]),
        ];
        const permitted = await tx.team.count({
          where: {
            groupID: { in: groupIDs },
            deletedAt: null,
            ...(!isSuperAdmin(user)
              ? {
                  OR: [
                    { ownerID: user.id },
                    {
                      members: {
                        some: {
                          userID: user.id,
                          role: { in: ["OWNER", "ADMIN"] },
                        },
                      },
                    },
                  ],
                }
              : {}),
          },
        });
        if (permitted !== groupIDs.length)
          throw new WorkspaceError("FORBIDDEN", 403);
        const existing = await tx.photo.findMany({
          where: {
            projectID: target.projectID,
            deletedAt: null,
            OR: rows.map((p) => ({
              userID: p.userID,
              ossFileName: p.ossFileName,
              timestamp: p.timestamp,
              largeURL: p.largeURL,
              smallURL: p.smallURL,
            })),
          },
          select: {
            userID: true,
            ossFileName: true,
            timestamp: true,
            largeURL: true,
            smallURL: true,
          },
        });
        const seen = new Set(
          existing.map((p) => copiedPhotoID(p, target.projectID)),
        );
        const data = rows
          .filter((p) => {
            const key = copiedPhotoID(p, target.projectID);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((p) => ({
            ...copyPhotoData(p, target),
            photoID: "webcopy_" + randomUUID(),
          }));
        const copied = data.length
          ? await tx.photo.createMany({ data })
          : { count: 0 };
        return {
          copied: copied.count,
          total: rows.length,
          projectID: target.projectID,
          groupID: target.groupID,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return workspaceResponse(result);
  } catch (e) {
    if (
      e instanceof Error &&
      ["SELECTION_LIMIT", "PHOTOS_UNAVAILABLE"].includes(e.message)
    )
      return workspaceResponse({ error: e.message }, 400);
    return workspaceFailure(e);
  }
}
