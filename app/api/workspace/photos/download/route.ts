import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { sourceFile, downloadHeaders } from "@/lib/workspace/files";
import {
  accessFor,
  photoWhere,
  workspaceUser,
  workspaceFailure,
  WorkspaceError,
} from "@/lib/workspace/server";
export async function GET(req: Request) {
  try {
    const user = await workspaceUser(req),
      params = new URL(req.url).searchParams;
    const access = await accessFor(params.get("groupID") || "", user.id);
    const photo = await prisma.photo.findFirst({
      where: {
        AND: [photoWhere(access), { photoID: params.get("photoID") || "" }],
      },
    });
    if (!photo) throw new WorkspaceError("FILE_UNAVAILABLE", 404);
    const file = await sourceFile(photo.largeURL || photo.smallURL, req.signal);
    return new Response(Readable.toWeb(file.stream) as ReadableStream, {
      headers: downloadHeaders(
        (photo.localPhotoName || photo.photoID).replace(/\.[^.]+$/, "") +
          file.extension,
        file.type,
      ),
    });
  } catch (e) {
    return workspaceFailure(e);
  }
}
