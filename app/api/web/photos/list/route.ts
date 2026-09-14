import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  galleryPage,
  galleryFacets,
  galleryWhere,
  readGalleryFilters,
  resolveGallerySelection,
} from "@/lib/web/query";
import { photoSelect, groupPhotosByDate } from "@/app/web/photos-data";
import { resolveLocale } from "@/lib/i18n";
import { readGalleryScope } from "@/lib/web/public-scope";
import { readPublicRequest } from "@/lib/web/request";
export async function POST(req: Request) {
  try {
    const body = await readPublicRequest(req);
    const b: Record<string, unknown> & { scope: ReturnType<typeof readGalleryScope> } = {
      ...body, scope: readGalleryScope(body.scope),
    };
    if (b.mode !== undefined && (typeof b.mode !== "string" || !["facets", "focused", "selection", "day"].includes(b.mode)))
      throw Error("INVALID_REQUEST");
    const f = readGalleryFilters(b.filters),
      snapshot = b.snapshot ?? new Date().toISOString();
    if (typeof snapshot !== "string") throw Error("INVALID_SNAPSHOT");
    if (b.mode === "facets")
      return NextResponse.json(await galleryFacets(b.scope), {
        headers: { "Cache-Control": "private, no-store" },
      });
    if (b.mode === "focused") {
      if (typeof b.photoID !== "string" || b.photoID.length > 100)
        throw Error("INVALID_PHOTO");
      const where = await galleryWhere(b.scope, f, snapshot);
      const row = await prisma.photo.findFirst({
        where: { AND: [where, { photoID: b.photoID }] },
        select: photoSelect,
      });
      if (!row) return NextResponse.json({ photos: [] });
      const before =
        f.sort === "asc" ? { lt: row.timestamp } : { gt: row.timestamp };
      const beforeID =
        f.sort === "asc" ? { lt: row.photoID } : { gt: row.photoID };
      const rank = await prisma.photo.count({
        where: {
          AND: [
            where,
            {
              OR: [
                { timestamp: before },
                { timestamp: row.timestamp, photoID: beforeID },
              ],
            },
          ],
        },
      });
      return NextResponse.json({
        photos: groupPhotosByDate([row], resolveLocale(typeof b.locale === "string" ? b.locale : undefined)).flatMap(
          (d) => d.photos,
        ),
        page: Math.floor(rank / 48) + 1,
      });
    }
    if (b.mode === "selection") {
      const where = await resolveGallerySelection({ ...b, snapshot }, 200);
      const rows = await prisma.photo.findMany({
        where,
        select: photoSelect,
        take: 200,
        orderBy: [
          { timestamp: f.sort as "asc" | "desc" },
          { photoID: f.sort as "asc" | "desc" },
        ],
      });
      return NextResponse.json({
        photos: groupPhotosByDate(rows, resolveLocale(typeof b.locale === "string" ? b.locale : undefined)).flatMap(
          (d) => d.photos,
        ),
      });
    }
    if (b.mode === "day") {
      if (typeof b.day !== "string" || !b.day) throw Error("INVALID_FILTER");
      const where = await galleryWhere(
        b.scope,
        readGalleryFilters({ ...f, from: b.day, to: b.day }),
        snapshot,
      );
      const total = await prisma.photo.count({ where });
      if (total > 5000) throw Error("SELECTION_LIMIT");
      const rows = await prisma.photo.findMany({
        where,
        select: { photoID: true },
        take: 5000,
      });
      return NextResponse.json({ ids: rows.map((p) => p.photoID) });
    }
    const page = Number(b.page ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 1000000)
      throw Error("INVALID_PAGE");
    return NextResponse.json(
      await galleryPage(b.scope, f, page, typeof b.locale === "string" ? b.locale : "", snapshot),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    const invalid = e instanceof SyntaxError || [
      "INVALID_REQUEST", "INVALID_SCOPE", "INVALID_FILTER", "INVALID_SNAPSHOT",
      "INVALID_PHOTO", "INVALID_PAGE", "INVALID_SELECTION", "SELECTION_LIMIT", "PHOTOS_UNAVAILABLE",
    ].includes(code);
    if (!invalid) console.error("[web/photos/list] query failed");
    return NextResponse.json(
      {
        error:
          invalid && code !== "" && !(e instanceof SyntaxError) ? code : "LOAD_FAILED",
      },
      { status: invalid ? 400 : 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
