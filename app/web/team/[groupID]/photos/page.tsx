import { notFound } from "next/navigation"
import { WebPhotoGallery } from "@/components/web/photo-gallery"
import { getTeamGallery } from "@/app/web/photos-data"

export default async function TeamPhotosPage({
  params,
}: {
  params: Promise<{ groupID: string }>
}) {
  const { groupID } = await params
  const { team, days, photoCount, memberCount } = await getTeamGallery(groupID)
  if (!team) notFound()

  return (
    <WebPhotoGallery
      header={{
        title: "团队所有照片",
        subtitle: team.groupName || "未设置地点",
        meta: `${photoCount} 张照片 · ${memberCount} 名成员`,
      }}
      days={days}
    />
  )
}
