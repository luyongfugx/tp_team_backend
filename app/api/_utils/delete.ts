import type { Prisma, User } from "@prisma/client"

type Tx = Prisma.TransactionClient
type TxWithTeamInviteCode = Tx & {
  teamInviteCode: { deleteMany: (args: unknown) => Promise<unknown> }
  teamFeed: { deleteMany: (args: unknown) => Promise<unknown> }
  teamFeedPhoto: { deleteMany: (args: unknown) => Promise<unknown> }
  teamFeedComment: { deleteMany: (args: unknown) => Promise<unknown> }
  teamFeedLike: { deleteMany: (args: unknown) => Promise<unknown> }
}

export async function deleteTeamData(tx: Tx, groupID: string) {
  await (tx as TxWithTeamInviteCode).teamFeedLike.deleteMany({ where: { groupID } })
  await (tx as TxWithTeamInviteCode).teamFeedComment.deleteMany({ where: { groupID } })
  await (tx as TxWithTeamInviteCode).teamFeedPhoto.deleteMany({ where: { groupID } })
  await (tx as TxWithTeamInviteCode).teamFeed.deleteMany({ where: { groupID } })
  await tx.photo.deleteMany({ where: { groupID } })
  await tx.projectMember.deleteMany({ where: { groupID } })
  await tx.project.deleteMany({ where: { groupID } })
  await tx.photoShare.deleteMany({ where: { groupID } })
  await tx.photoPackageTask.deleteMany({ where: { groupID } })
  await tx.photoPdfSetting.deleteMany({ where: { groupID } })
  await tx.teamInviteLink.deleteMany({ where: { groupID } })
  await (tx as TxWithTeamInviteCode).teamInviteCode.deleteMany({ where: { groupID } })
  await tx.teamEmailInvite.deleteMany({ where: { groupID } })
  await tx.teamMember.deleteMany({ where: { groupID } })
  await tx.team.delete({ where: { groupID } })
}

export async function deleteUserData(tx: Tx, user: Pick<User, "id" | "email">) {
  const ownedTeams = await tx.team.findMany({
    where: { ownerID: user.id },
    select: { groupID: true },
  })

  for (const team of ownedTeams) {
    await deleteTeamData(tx, team.groupID)
  }

  await (tx as TxWithTeamInviteCode).teamFeedPhoto.deleteMany({ where: { photo: { userID: user.id } } })
  await tx.photo.deleteMany({ where: { userID: user.id } })
  await tx.projectMember.deleteMany({ where: { userID: user.id } })
  await tx.teamMember.deleteMany({ where: { userID: user.id } })
  await tx.teamEmailInvite.deleteMany({
    where: {
      OR: [{ inviterID: user.id }, { email: user.email }],
    } as never,
  })
  await (tx as TxWithTeamInviteCode).teamFeedLike.deleteMany({ where: { userID: user.id } })
  await (tx as TxWithTeamInviteCode).teamFeedComment.deleteMany({ where: { userID: user.id } })
  await (tx as TxWithTeamInviteCode).teamFeed.deleteMany({ where: { createdByUserID: user.id } })
  await tx.session.deleteMany({ where: { userId: user.id } })
  await tx.verificationCode.deleteMany({ where: { email: user.email } })
  await tx.user.delete({ where: { id: user.id } })
}
