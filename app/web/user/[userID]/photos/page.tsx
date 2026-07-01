import { notFound } from "next/navigation"
import { WebPhotoGallery } from "@/components/web/photo-gallery"
import { getUserGallery } from "@/app/web/photos-data"
import { resolveLocale, supportedLocaleOptions, t } from "@/lib/i18n"

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function UserPhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ userID: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { userID } = await params
  const query = await searchParams
  const locale = resolveLocale(firstParam(query.lang) || firstParam(query.locale) || firstParam(query.language))
  const { user, days, photoCount } = await getUserGallery(userID, locale)
  if (!user) notFound()

  const displayName = user.userName || user.shortName || user.email.split("@")[0]

  return (
    <WebPhotoGallery
      header={{
        title: displayName,
        subtitle: t(locale, "web.userAllPhotos"),
        meta: t(locale, "web.photoCount", { count: photoCount }),
      }}
      days={days}
      currentLocale={locale}
      languageOptions={supportedLocaleOptions}
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
        open: t(locale, "web.bannerOpen"),
        bannerTitle: t(locale, "web.bannerTitle"),
        bannerSubtitle: t(locale, "web.bannerSubtitle"),
      }}
    />
  )
}
