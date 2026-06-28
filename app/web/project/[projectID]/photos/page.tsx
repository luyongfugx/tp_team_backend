import { notFound } from "next/navigation"
import { WebPhotoGallery } from "@/components/web/photo-gallery"
import { getProjectGallery } from "@/app/web/photos-data"

export default async function ProjectPhotosPage({
  params,
}: {
  params: Promise<{ projectID: string }>
}) {
  const { projectID: rawProjectID } = await params
  const projectID = Number(rawProjectID)
  if (!Number.isFinite(projectID)) notFound()

  const { project, days, photoCount, memberCount } = await getProjectGallery(projectID)
  if (!project) notFound()

  return (
    <WebPhotoGallery
      header={{
        title: project.projectName,
        subtitle: project.address || project.team.groupName || "未设置地点",
        meta: `${photoCount} 张照片 · ${memberCount} 名成员`,
      }}
      days={days}
    />
  )
}
