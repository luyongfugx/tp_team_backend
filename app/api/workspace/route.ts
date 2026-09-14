import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/app/api/_utils/admin";
import {
  accessFor,
  photoWhere,
  workspaceUser,
  workspaceResponse,
  workspaceFailure,
} from "@/lib/workspace/server";
import { resolvePhotoURL } from "@/app/web/photo-url";

export async function GET(req: Request) {
  try {
    const user = await workspaceUser(req);
    // Workspace picker lists memberships; platform-wide administration stays separate.
    const teams = await prisma.team.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerID: user.id }, { members: { some: { userID: user.id } } }],
      },
      select: { groupID: true, groupName: true },
      orderBy: { groupName: "asc" },
    });
    const groupID =
      new URL(req.url).searchParams.get("groupID") || teams[0]?.groupID;
    if (!groupID)
      return workspaceResponse({
        teams,
        current: null,
        canManage: false,
        isSuperAdmin: isSuperAdmin(user),
        projects: [],
        members: [],
        photoCount: 0,
      });
    const access = await accessFor(groupID, user.id);
    const where = photoWhere(access);
    const [projects, members, projectCounts, memberCounts, recent, photoCount] =
      await Promise.all([
        prisma.project.findMany({
          where: {
            groupID,
            deletedAt: null,
            ...(!access.canManage
              ? {
                  OR: [
                    { members: { some: { userID: user.id } } },
                    { photos: { some: { userID: user.id, deletedAt: null } } },
                  ],
                }
              : {}),
          },
          select: {
            projectID: true,
            projectName: true,
            address: true,
            _count: { select: { members: true } },
          },
          orderBy: { updatedAt: "desc" },
        }),
        prisma.teamMember.findMany({
          where: {
            groupID,
            ...(!access.canManage ? { userID: user.id } : {}),
            user: { deletedAt: null },
          },
          select: {
            userID: true,
            role: true,
            user: { select: { userName: true, email: true, avatar: true } },
          },
          orderBy: { joinedAt: "asc" },
        }),
        prisma.photo.groupBy({
          by: ["projectID"],
          where,
          _count: true,
          _max: { timestamp: true },
        }),
        prisma.photo.groupBy({
          by: ["userID"],
          where,
          _count: true,
          _max: { timestamp: true },
        }),
        prisma.photo.findMany({
          where,
          select: {
            projectID: true,
            userID: true,
            smallURL: true,
            largeURL: true,
          },
          orderBy: [{ timestamp: "desc" }, { photoID: "desc" }],
          take: 120,
        }),
        prisma.photo.count({ where }),
      ]);
    // Older projects/members may have no image in the team's latest 120. Fetch only three authorized thumbnails for those cards.
    const fallbackCovers = new Map<string, string[]>();
    const missing = [
      ...projects
        .filter(
          (p) =>
            projectCounts.some(
              (c) => c.projectID === p.projectID && c._count > 0,
            ) && !recent.some((r) => r.projectID === p.projectID),
        )
        .map((p) => ({ key: "projectID" as const, id: p.projectID })),
      ...members
        .filter(
          (m) =>
            memberCounts.some((c) => c.userID === m.userID && c._count > 0) &&
            !recent.some((r) => r.userID === m.userID),
        )
        .map((m) => ({ key: "userID" as const, id: m.userID })),
    ];
    for (let start = 0; start < missing.length; start += 8)
      await Promise.all(
        missing.slice(start, start + 8).map(async (scope) => {
          const rows = await prisma.photo.findMany({
            where: { AND: [where, { [scope.key]: scope.id }] },
            select: { smallURL: true, largeURL: true },
            orderBy: [{ timestamp: "desc" }, { photoID: "desc" }],
            take: 3,
          });
          fallbackCovers.set(
            `${scope.key}:${scope.id}`,
            rows
              .map((p) => resolvePhotoURL(p.smallURL || p.largeURL))
              .filter((x): x is string => !!x),
          );
        }),
      );
    const covers = (key: "projectID" | "userID", id: number | string) =>
      fallbackCovers.get(`${key}:${id}`) ||
      recent
        .filter((p) => p[key] === id)
        .map((p) => resolvePhotoURL(p.smallURL || p.largeURL))
        .filter((x): x is string => !!x)
        .slice(0, 3);
    return workspaceResponse({
      teams,
      current: access.team,
      canManage: access.canManage,
      isSuperAdmin: isSuperAdmin(user),
      photoCount,
      projects: projects.map((p) => {
        const stats = projectCounts.find((x) => x.projectID === p.projectID);
        return {
          projectID: p.projectID,
          projectName: p.projectName,
          address: p.address,
          count: stats?._count || 0,
          latest: stats?._max.timestamp ? Number(stats._max.timestamp) : null,
          covers: covers("projectID", p.projectID),
          memberCount: p._count.members,
        };
      }),
      members: members.map((m) => {
        const stats = memberCounts.find((x) => x.userID === m.userID);
        return {
          userID: m.userID,
          name: m.user.userName || m.user.email || "—",
          avatar: m.user.avatar,
          role: m.role,
          count: stats?._count || 0,
          latest: stats?._max.timestamp ? Number(stats._max.timestamp) : null,
          covers: covers("userID", m.userID),
        };
      }),
    });
  } catch (e) {
    return workspaceFailure(e);
  }
}
