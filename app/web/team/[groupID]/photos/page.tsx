import { notFound } from "next/navigation"
import { WebPhotoGallery } from "@/components/web/photo-gallery"
import { getTeamGallery } from "@/app/web/photos-data"
import { resolveLocale, t } from "@/lib/i18n"

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function TeamPhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupID: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { groupID } = await params
  const query = await searchParams
  const locale = resolveLocale(firstParam(query.lang) || firstParam(query.locale) || firstParam(query.language))
  const { team, days, photoCount, memberCount } = await getTeamGallery(groupID, locale)
  if (!team) notFound()

  return (
    <WebPhotoGallery
      header={{
        title: t(locale, "web.teamAllPhotos"),
        subtitle: team.groupName || t(locale, "web.noLocation"),
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
