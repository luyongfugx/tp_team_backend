import type { User } from "@prisma/client"
import { prisma } from "@/lib/prisma"

function defaultTeamName(user: Pick<User, "email" | "userName" | "shortName">) {
  const name = user.userName?.trim() || user.shortName?.trim() || user.email.split("@")[0] || "User"
  return `${name}'s team`
}

export async function createDefaultTeamIfNeeded(user: Pick<User, "id" | "email" | "userName" | "shortName">) {
  const now = new Date()
  const [membership, pendingInvite] = await Promise.all([
    prisma.teamMember.findFirst({
      where: { userID: user.id, team: { deletedAt: null } },
      select: { groupID: true },
    }),
    prisma.teamEmailInvite.findFirst({
      where: {
        email: user.email,
        acceptedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        team: { deletedAt: null },
      },
      select: { id: true },
    }),
  ])

  if (membership || pendingInvite) return null

  return prisma.team.create({
    data: {
      groupName: defaultTeamName(user),
      ownerID: user.id,
      members: { create: { userID: user.id, role: "OWNER", roleID: 1 } },
    },
    select: { groupID: true },
  })
}
