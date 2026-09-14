import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { publicPhotoBaseWhere } from "@/lib/web/public-scope";
import { downloadHeaders, sourceFile } from "@/lib/workspace/files";
export async function GET(req: Request) {
  const photoID = new URL(req.url).searchParams.get("photoID") || "";
  if (!photoID || photoID.length > 100)
    return NextResponse.json({ error: "INVALID_PHOTO" }, { status: 400 });
  const photo = await prisma.photo.findFirst({
    where: { AND: [publicPhotoBaseWhere(), { photoID }] },
    select: {
      photoID: true,
      largeURL: true,
      smallURL: true,
      localPhotoName: true,
      ossFileName: true,
    },
  });
  if (!photo)
    return NextResponse.json({ error: "PHOTO_UNAVAILABLE" }, { status: 404 });
  try {
    const source = await sourceFile(
      photo.largeURL || photo.smallURL,
      req.signal,
    );
    return new Response(Readable.toWeb(source.stream) as ReadableStream, {
      headers: downloadHeaders(
        photo.localPhotoName ||
          photo.ossFileName.split("/").pop() ||
          photo.photoID + source.extension,
        source.type,
      ),
    });
  } catch {
    return NextResponse.json({ error: "DOWNLOAD_FAILED" }, { status: 502 });
  }
}
