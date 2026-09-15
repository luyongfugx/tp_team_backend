import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  workspaceUser,
  accessFor,
  workspaceResponse,
  workspaceFailure,
  WorkspaceError,
} from "@/lib/workspace/server";
import { readGalleryScope } from "@/lib/web/public-scope";
import { readPublicRequest } from "@/lib/web/request";
import { resolveLocale } from "@/lib/i18n";
export async function POST(req: Request) {
  try {
    const user = await workspaceUser(req),
      body = await readPublicRequest(req),
      scope = readGalleryScope(body.scope);
    const access = await accessFor(
      typeof body.groupID === "string" ? body.groupID : "",
      user.id,
    );
    if (scope.kind === "team" && scope.id !== access.team.groupID)
      throw new WorkspaceError("FORBIDDEN", 403);
    if (
      scope.kind === "project" &&
      !(await prisma.project.count({
        where: {
          projectID: Number(scope.id),
          groupID: access.team.groupID,
          deletedAt: null,
        },
      }))
    )
      throw new WorkspaceError("FORBIDDEN", 403);
    if (scope.kind === "user" && scope.id !== user.id) {
      if (
        !access.canManage ||
        !(await prisma.photo.count({
          where: {
            groupID: access.team.groupID,
            userID: scope.id,
            deletedAt: null,
          },
        }))
      )
        throw new WorkspaceError("FORBIDDEN", 403);
    }
    const shareKey = randomUUID(),
      locale = resolveLocale(
        typeof body.locale === "string" ? body.locale : "en",
      );
    const url = `/web/${scope.kind}/${encodeURIComponent(scope.id)}/photos?shareKey=${shareKey}&lang=${encodeURIComponent(locale)}`;
    await prisma.photoShare.create({
      data: {
        groupID: access.team.groupID,
        shareKey,
        url,
        fromPlace: "web-gallery",
        filters: { scope },
        createdByUserID: user.id,
        keepUpdate: true,
      },
    });
    return workspaceResponse({ url });
  } catch (e) {
    return workspaceFailure(e);
  }
}
