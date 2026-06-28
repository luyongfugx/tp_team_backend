import { notFound } from "next/navigation"
import { WebPhotoGallery } from "@/components/web/photo-gallery"
import { getProjectGallery } from "@/app/web/photos-data"
import { resolveLocale, t } from "@/lib/i18n"

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function ProjectPhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectID: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { projectID: rawProjectID } = await params
  const query = await searchParams
  const locale = resolveLocale(firstParam(query.lang) || firstParam(query.locale) || firstParam(query.language))
  const projectID = Number(rawProjectID)
  if (!Number.isFinite(projectID)) notFound()

  const { project, days, photoCount, memberCount } = await getProjectGallery(projectID, locale)
  if (!project) notFound()

  return (
    <WebPhotoGallery
      header={{
        title: project.projectName,
        subtitle: project.address || project.team.groupName || t(locale, "web.noLocation"),
        meta: `${t(locale, "web.photoCount", { count: photoCount })} · ${t(locale, "web.memberCount", { count: memberCount })}`,
      }}
      days={days}
      labels={{
        back: t(locale, "web.back"),
        noPhotos: t(locale, "web.noPhotos"),
        noPhotosHint: t(locale, "web.noPhotosHint"),
        viewLarge: t(locale, "web.viewLarge"),
        teamPhoto: t(locale, "web.teamPhoto"),
        downloadImage: t(locale, "web.downloadImage"),
        close: t(locale, "web.close"),
        download: t(locale, "web.download"),
        largeImage: t(locale, "web.largeImage"),
      }}
    />
  )
}
