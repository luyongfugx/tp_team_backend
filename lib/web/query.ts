import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicPhotoWhere } from "./public-scope";
import {
  defaultFilters,
  type GalleryFilters,
  type GalleryScope,
} from "./gallery";
import { dateBoundary } from "@/lib/workspace/model";
import {
  parseOffsetMinutes,
  photoTimeZone,
  photoSelect,
  groupPhotosByDate,
} from "@/app/web/photos-data";
import { resolveLocale } from "@/lib/i18n";
export function readGalleryFilters(input: unknown): GalleryFilters {
  const f = { ...defaultFilters };
  if (input !== undefined && (!input || typeof input !== "object" || Array.isArray(input)))
    throw Error("INVALID_FILTER");
  if (input && typeof input === "object")
    for (const key of Object.keys(f) as (keyof GalleryFilters)[]) {
      const v = (input as Record<string, unknown>)[key];
      if (v !== undefined) {
        if (typeof v !== "string" || v.length > 200)
          throw Error("INVALID_FILTER");
        f[key] = v;
      }
    }
  if (
    !["asc", "desc"].includes(f.sort) ||
    !["", "0", "1"].includes(f.type) ||
    (f.project && (!/^[1-9]\d{0,9}$/.test(f.project) || Number(f.project) > 2147483647))
  )
    throw Error("INVALID_FILTER");
  for (const value of [f.from, f.to]) if (value) dateBoundary(value, "UTC");
  if (f.from && f.to && f.from > f.to) throw Error("INVALID_FILTER");
  return f;
}
export async function galleryWhere(
  scope: GalleryScope,
  f: GalleryFilters,
  snapshot?: string,
): Promise<Prisma.PhotoWhereInput> {
  const and: Prisma.PhotoWhereInput[] = [publicPhotoWhere(scope)];
  if (snapshot) {
    const date = new Date(snapshot);
    if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 60000)
      throw Error("INVALID_SNAPSHOT");
    and.push({ createdAt: { lte: date } });
  }
  if (f.q.trim())
    and.push({
      OR: ["localPhotoName", "location", "userName", "projectName"].map(
        (key) => ({ [key]: { contains: f.q.trim() } }),
      ),
    });
  if (f.project) and.push({ projectID: Number(f.project) });
  if (f.member) and.push({ userID: f.member });
  if (f.type) and.push({ mediaType: Number(f.type) });
  if (f.from || f.to) {
    // Photo-local date boundaries are evaluated per recorded timezone, without scanning photo rows in JS.
    const zones = await prisma.photo.groupBy({
      by: ["takePhotoTimezoneID"],
      where: { AND: and },
    });
    const clauses = zones.map(({ takePhotoTimezoneID }) => {
      const zone = photoTimeZone(takePhotoTimezoneID),
        offset = parseOffsetMinutes(zone);
      const boundary = (date: string, next = false) =>
        BigInt(
          offset == null
            ? dateBoundary(date, zone, next)
            : dateBoundary(date, "UTC", next) - offset * 60000,
        );
      return {
        takePhotoTimezoneID,
        timestamp: {
          ...(f.from ? { gte: boundary(f.from) } : {}),
          ...(f.to ? { lt: boundary(f.to, true) } : {}),
        },
      };
    });
    and.push({ OR: clauses.length ? clauses : [{ photoID: { in: [] } }] });
  }
  return { AND: and };
}
export async function galleryPage(
  scope: GalleryScope,
  f: GalleryFilters,
  page: number,
  locale: string,
  snapshot: string,
) {
  const where = await galleryWhere(scope, f, snapshot);
  const total = await prisma.photo.count({ where }),
    actualPage = Math.min(
      Math.max(1, page),
      Math.max(1, Math.ceil(total / 48)),
    );
  const rows = await prisma.photo.findMany({
    where,
    select: photoSelect,
    take: 48,
    skip: (actualPage - 1) * 48,
    orderBy: [
      { timestamp: f.sort as "asc" | "desc" },
      { photoID: f.sort as "asc" | "desc" },
    ],
  });
  return {
    photos: groupPhotosByDate(rows, resolveLocale(locale)).flatMap(
      (d) => d.photos,
    ),
    total,
    page: actualPage,
    snapshot,
  };
}
export async function galleryFacets(scope: GalleryScope) {
  const where = publicPhotoWhere(scope);
  const rows = await prisma.photo.groupBy({
    by: ["projectID", "userID"],
    where,
  });
  const projectIDs = [
      ...new Set(
        rows.flatMap((r) => (r.projectID == null ? [] : [r.projectID])),
      ),
    ],
    userIDs = [...new Set(rows.map((r) => r.userID))];
  const [projects, members] = await Promise.all([
    prisma.project.findMany({
      where: { projectID: { in: projectIDs } },
      select: { projectID: true, projectName: true },
    }),
    prisma.user.findMany({
      where: { id: { in: userIDs } },
      select: { id: true, userName: true, shortName: true },
    }),
  ]);
  return {
    projects: projects.map((p) => [String(p.projectID), p.projectName]),
    members: members.map((u) => [u.id, u.userName || u.shortName || "—"]),
  };
}
export async function resolveGallerySelection(
  body: {
    scope: GalleryScope;
    filters?: unknown;
    snapshot?: string;
    ids?: unknown;
    all?: boolean;
    excluded?: unknown;
    expectedCount?: unknown;
  },
  limit: number,
) {
  if (body.all !== undefined && typeof body.all !== "boolean") throw Error("INVALID_SELECTION");
  const where = await galleryWhere(
    body.scope,
    readGalleryFilters(body.filters),
    body.snapshot,
  );
  const validIDs = (raw: unknown) => {
    if (
      !Array.isArray(raw) ||
      raw.length > 5000 ||
      raw.some((id) => typeof id !== "string" || !id || id.length > 100)
    )
      throw Error("INVALID_SELECTION");
    return [...new Set<string>(raw)];
  };
  const ids = body.all ? undefined : validIDs(body.ids),
    excluded = body.all ? validIDs(body.excluded || []) : [];
  if (ids && ids.length > limit) throw Error("SELECTION_LIMIT");
  const selectedWhere: Prisma.PhotoWhereInput = {
    AND: [
      where,
      ids ? { photoID: { in: ids } } : { photoID: { notIn: excluded } },
    ],
  };
  const count = await prisma.photo.count({ where: selectedWhere });
  if (ids && count !== ids.length) throw Error("PHOTOS_UNAVAILABLE");
  if (body.expectedCount !== undefined) {
    if (!Number.isSafeInteger(body.expectedCount) || Number(body.expectedCount) < 1)
      throw Error("INVALID_SELECTION");
    if (body.expectedCount !== count) throw Error("PHOTOS_UNAVAILABLE");
  }
  if (!count || count > limit) throw Error("SELECTION_LIMIT");
  return selectedWhere;
}
