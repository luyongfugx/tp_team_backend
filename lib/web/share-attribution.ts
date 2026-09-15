import { prisma } from "@/lib/prisma";
import type { GalleryScope } from "./gallery";
export async function verifiedShareAttribution(
  key: string | undefined,
  scope: GalleryScope,
) {
  if (!key || !/^[a-f0-9-]{36}$/.test(key)) return undefined;
  const share = await prisma.photoShare.findUnique({
    where: { shareKey: key },
    select: {
      fromPlace: true,
      filters: true,
      createdByUserID: true,
      expiresAt: true,
      team: { select: { deletedAt: true } },
    },
  });
  if (
    !share ||
    share.fromPlace !== "web-gallery" ||
    share.team.deletedAt ||
    (share.expiresAt && share.expiresAt < new Date())
  )
    return undefined;
  const stored = share.filters as { scope?: GalleryScope } | null;
  if (
    stored?.scope?.kind !== scope.kind ||
    stored.scope.id !== scope.id ||
    !share.createdByUserID
  )
    return undefined;
  const user = await prisma.user.findFirst({
    where: { id: share.createdByUserID, deletedAt: null },
    select: { userName: true, shortName: true },
  });
  return user?.userName || user?.shortName || undefined;
}
