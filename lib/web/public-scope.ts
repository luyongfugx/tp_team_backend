import type { Prisma } from "@prisma/client";
import type { GalleryScope } from "./gallery";
// Only the legacy single-photo download can use this base without a collection scope.
export function publicPhotoBaseWhere(): Prisma.PhotoWhereInput {
  return {
    deletedAt: null,
    team: { deletedAt: null },
    user: { deletedAt: null },
    OR: [{ projectID: null }, { project: { deletedAt: null } }],
  };
}

export function readGalleryScope(value: unknown): GalleryScope {
  if (
    !value || typeof value !== "object" || Array.isArray(value)
  ) throw new Error("INVALID_SCOPE");
  const scope = value as GalleryScope;
  if (
    typeof scope.id !== "string" || !scope.id.trim() ||
    scope.id.length > 100 ||
    !["project", "team", "user"].includes(scope.kind)
  )
    throw new Error("INVALID_SCOPE");
  if (
    scope.kind === "project" &&
    (!/^[1-9]\d*$/.test(scope.id) || Number(scope.id) > 2147483647)
  )
    throw new Error("INVALID_SCOPE");
  return { kind: scope.kind, id: scope.id };
}

// Collection queries must never fall back to an unscoped database query.
export function publicPhotoWhere(value: GalleryScope): Prisma.PhotoWhereInput {
  const scope = readGalleryScope(value);
  return {
    AND: [
      publicPhotoBaseWhere(),
      scope.kind === "project"
        ? { projectID: Number(scope.id) }
        : scope.kind === "team"
          ? { groupID: scope.id }
          : { userID: scope.id },
    ],
  };
}
