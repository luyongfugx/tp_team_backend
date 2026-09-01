import { prisma } from "@/lib/prisma"
import { badFor, jsonSafe, ok, requireUser, serverError } from "@/app/api/_utils/api"
import { isSuperAdmin } from "@/app/api/_utils/admin"
import { resolvePhotoURL, thumbnailPhotoURL } from "@/app/web/photo-url"

const MAX_PAGE_SIZE = 30

function paging(url: URL) {
  const requestedPage = Number(url.searchParams.get("page") || "1")
  const requestedPageSize = Number(url.searchParams.get("pageSize") || String(MAX_PAGE_SIZE))
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1
  const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
    ? Math.min(Math.floor(requestedPageSize), MAX_PAGE_SIZE)
    : MAX_PAGE_SIZE
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) return badFor(req, "未授权或登录已过期", 401)
    if (!isSuperAdmin(user)) return badFor(req, "无总管理员权限", 403)

    const url = new URL(req.url)
    const { page, pageSize, skip } = paging(url)
    const search = (url.searchParams.get("search") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
    const where = {
      deletedAt: null,
      mediaType: 0,
      antiFakeCode: search ? { startsWith: search } : { not: "" },
      largeURL: { not: "" },
    } as never

    const [totalCount, photos] = await Promise.all([
      prisma.photo.count({ where }),
      prisma.photo.findMany({
        where,
        orderBy: [{ timestamp: "desc" }, { photoID: "desc" }],
        skip,
        take: pageSize,
        select: {
          photoID: true,
          antiFakeCode: true,
          timestamp: true,
          takePhotoFormatTime: true,
          takePhotoTimezoneID: true,
          smallURL: true,
          largeURL: true,
          userName: true,
          projectName: true,
          location: true,
          createdAt: true,
          team: { select: { groupID: true, groupName: true } },
        },
      }),
    ])

    return ok(jsonSafe({
      photos: photos.map((photo) => {
        const imageURL = resolvePhotoURL(photo.smallURL || photo.largeURL)
        return {
          photoID: photo.photoID,
          photoCode: photo.antiFakeCode,
          thumbnailURL: thumbnailPhotoURL(imageURL),
          captureTime: photo.takePhotoFormatTime,
          timeZone: photo.takePhotoTimezoneID,
          userName: photo.userName,
          projectName: photo.projectName,
          location: photo.location,
          team: photo.team,
          createdAt: photo.createdAt,
        }
      }),
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      },
      search,
    }))
  } catch (error) {
    console.log("[app/admin/photo-code-photos] error:", error)
    return serverError(req)
  }
}
