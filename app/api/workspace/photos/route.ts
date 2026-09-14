import { prisma } from "@/lib/prisma";
import { readFilters } from "@/lib/workspace/model";
import {
  accessFor,
  photoWhere,
  photoFields,
  mapPhoto,
  workspaceUser,
  workspaceResponse,
  workspaceFailure,
} from "@/lib/workspace/server";
export async function GET(req: Request) {
  try {
    const user = await workspaceUser(req);
    const params = new URL(req.url).searchParams;
    const access = await accessFor(params.get("groupID") || "", user.id);
    const filters = readFilters(params);
    const where = photoWhere(access, filters);
    const requested = Number(params.get("page") || 1);
    if (!Number.isSafeInteger(requested) || requested < 1)
      throw new Error("INVALID_PAGE");
    const total = await prisma.photo.count({ where });
    const pageSize = 48,
      pages = Math.max(1, Math.ceil(total / pageSize)),
      page = Math.min(requested, pages);
    const photos = await prisma.photo.findMany({
      where,
      select: photoFields,
      orderBy: [{ timestamp: "desc" }, { photoID: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    // A copied deep link can open a photo outside the current page, within exactly the same authorized filters.
    const focus = params.get("photo");
    const focused =
      focus && !photos.some((p) => p.photoID === focus)
        ? await prisma.photo.findFirst({
            where: { AND: [where, { photoID: focus }] },
            select: photoFields,
          })
        : null;
    return workspaceResponse({
      photos: photos.map(mapPhoto),
      focused: focused ? mapPhoto(focused) : null,
      total,
      pages,
      page,
      pageSize,
    });
  } catch (e) {
    return workspaceFailure(e);
  }
}
