import { prisma } from "@/lib/prisma";
import {
  accessFor,
  workspaceUser,
  workspaceResponse,
  workspaceFailure,
  WorkspaceError,
} from "@/lib/workspace/server";
export async function POST(req: Request) {
  try {
    const user = await workspaceUser(req),
      body = await req.json();
    const access = await accessFor(
      typeof body.groupID === "string" ? body.groupID : "",
      user.id,
    );
    if (!access.canManage) throw new WorkspaceError("FORBIDDEN", 403);
    if (
      typeof body.projectName !== "string" ||
      !body.projectName.trim() ||
      body.projectName.trim().length > 100 ||
      (body.address &&
        (typeof body.address !== "string" || body.address.length > 191))
    )
      throw new WorkspaceError("INVALID_PROJECT");
    const data = {
      projectName: body.projectName.trim(),
      address: body.address?.trim() || null,
    };
    if (body.projectID) {
      if (!Number.isSafeInteger(body.projectID))
        throw new WorkspaceError("INVALID_PROJECT");
      const updated = await prisma.project.updateMany({
        where: {
          projectID: body.projectID,
          groupID: access.team.groupID,
          deletedAt: null,
        },
        data,
      });
      if (!updated.count) throw new WorkspaceError("FORBIDDEN", 403);
      return workspaceResponse({ projectID: body.projectID });
    }
    const members = await prisma.teamMember.findMany({
      where: { groupID: access.team.groupID },
    });
    const project = await prisma.project.create({
      data: {
        ...data,
        groupID: access.team.groupID,
        members: {
          create: members.map((m) => ({
            groupID: m.groupID,
            userID: m.userID,
            role: m.role,
            roleID: m.roleID,
          })),
        },
      },
    });
    return workspaceResponse({ projectID: project.projectID }, 201);
  } catch (e) {
    return workspaceFailure(e);
  }
}
