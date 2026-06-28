import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolvePhotoURL } from "@/app/web/photo-url"

function safeFilename(value: string | null | undefined, fallback: string) {
  const name = (value || fallback).replace(/[\\/:*?"<>|]+/g, "_").trim()
  return name || fallback
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const photoID = url.searchParams.get("photoID") || ""
  if (!photoID) return NextResponse.json({ error: "参数不正确" }, { status: 400 })

  const photo = await prisma.photo.findFirst({
    where: { photoID, deletedAt: null },
    select: { photoID: true, largeURL: true, smallURL: true, localPhotoName: true, ossFileName: true },
  })
  const imageURL = resolvePhotoURL(photo?.largeURL || photo?.smallURL)
  if (!photo || !imageURL) return NextResponse.json({ error: "照片不存在" }, { status: 404 })
  if (!/^https?:\/\//i.test(imageURL)) {
    return NextResponse.json({ error: "图片地址未配置 COS_PUBLIC_BASE_URL" }, { status: 400 })
  }

  const upstream = await fetch(imageURL)
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "图片下载失败" }, { status: 502 })
  }

  const fallbackName = `${photo.photoID}.jpg`
  const sourceName = photo.localPhotoName || photo.ossFileName?.split("/").pop()
  const filename = safeFilename(sourceName, fallbackName)
  const headers = new Headers()
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/octet-stream")
  headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
  const length = upstream.headers.get("Content-Length")
  if (length) headers.set("Content-Length", length)

  return new NextResponse(upstream.body, { headers })
}
