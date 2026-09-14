import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicPhotoWhere } from "@/lib/web/public-scope";
import type { WebPhoto, WebPhotoDay } from "@/components/web/photo-gallery";
import { resolvePhotoURL, thumbnailPhotoURL } from "@/app/web/photo-url";
import { localeDateCode, resolveLocale, type AppLocale } from "@/lib/i18n";

export const photoSelect = {
  photoID: true,
  systemInfo: true,
  projectID: true,
  userID: true,
  mediaType: true,
  duration: true,
  lat: true,
  lng: true,
  timestamp: true,
  takePhotoFormatTime: true,
  takePhotoTimezoneID: true,
  smallURL: true,
  largeURL: true,
  localPhotoName: true,
  location: true,
  userName: true,
  projectName: true,
} satisfies Prisma.PhotoSelect;

type GalleryPhotoRecord = Prisma.PhotoGetPayload<{
  select: typeof photoSelect;
}>;

function photoDate(photo: GalleryPhotoRecord) {
  const millis = Number(photo.timestamp);
  if (Number.isFinite(millis) && millis > 0) return new Date(millis);
  const parsed = Date.parse(photo.takePhotoFormatTime.replace(" ", "T"));
  return Number.isFinite(parsed) ? new Date(parsed) : new Date(0);
}

export function parseOffsetMinutes(timeZone: string) {
  const trimmed = timeZone.trim();
  if (/^(GMT|UTC|Z)$/i.test(trimmed)) return 0;
  const match = trimmed.match(/^(?:GMT|UTC)?([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours > 23 ||
    minutes > 59
  )
    return null;
  return (match[1] === "-" ? -1 : 1) * (hours * 60 + minutes);
}

const zoneValidity = new Map<string, boolean>();
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify([locale, options]);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    if (formatters.size >= 256) formatters.clear();
    formatters.set(key, f);
  }
  return f;
}
function validIanaTimeZone(timeZone: string) {
  if (zoneValidity.has(timeZone)) return zoneValidity.get(timeZone)!;
  try {
    formatter("en-US", { timeZone }).format(new Date());
    if (zoneValidity.size >= 256) zoneValidity.clear();
    zoneValidity.set(timeZone, true);
    return true;
  } catch {
    if (zoneValidity.size >= 256) zoneValidity.clear();
    zoneValidity.set(timeZone, false);
    return false;
  }
}

export function photoTimeZone(timeZone: string | null | undefined) {
  const value =
    typeof timeZone === "string" && timeZone.trim() ? timeZone.trim() : "";
  if (value && (parseOffsetMinutes(value) != null || validIanaTimeZone(value)))
    return value;
  return "Asia/Shanghai";
}

function formatInPhotoTimeZone(
  date: Date,
  locale: AppLocale,
  timeZoneInput: string,
  options: Intl.DateTimeFormatOptions,
) {
  const offsetMinutes = parseOffsetMinutes(timeZoneInput);
  const zonedDate =
    offsetMinutes == null
      ? date
      : new Date(date.getTime() + offsetMinutes * 60 * 1000);
  const timeZone = offsetMinutes == null ? timeZoneInput : "UTC";
  return formatter(localeDateCode(locale), {
    timeZone,
    ...options,
  }).format(zonedDate);
}

function formatDate(date: Date, locale: AppLocale, timeZoneInput: string) {
  const dateLocale = localeDateCode(locale);
  const offsetMinutes = parseOffsetMinutes(timeZoneInput);
  const zonedDate =
    offsetMinutes == null
      ? date
      : new Date(date.getTime() + offsetMinutes * 60 * 1000);
  const timeZone = offsetMinutes == null ? timeZoneInput : "UTC";
  if (locale === "zh-Hans" || locale === "zh-Hant") {
    const parts = formatter(dateLocale, {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(zonedDate);
    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value || "";
    return `${get("year")} 年 ${get("month")} 月 ${get("day")} 日`;
  }
  return formatter(dateLocale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(zonedDate);
}

export function formatDateTime(
  date: Date,
  locale: AppLocale,
  timeZoneInput: string,
) {
  return formatInPhotoTimeZone(date, locale, timeZoneInput, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function groupPhotosByDate(
  records: GalleryPhotoRecord[],
  locale: AppLocale,
): WebPhotoDay[] {
  const grouped = new Map<string, WebPhoto[]>();
  for (const photo of records) {
    const date = photoDate(photo);
    const timeZone = photoTimeZone(photo.takePhotoTimezoneID);
    const dateText = formatDate(date, locale, timeZone);
    const imageURL = resolvePhotoURL(photo.largeURL || photo.smallURL);
    const system =
      photo.systemInfo &&
      typeof photo.systemInfo === "object" &&
      !Array.isArray(photo.systemInfo)
        ? photo.systemInfo
        : {};
    const field = (...keys: string[]) =>
      keys.map((k) => system[k]).find((v) => typeof v === "string") as
        string | undefined;
    const item: WebPhoto = {
      photoID: photo.photoID,
      device: field("deviceModel", "model") || null,
      os: field("systemVersion", "osVersion", "os") || null,
      projectID: photo.projectID,
      userID: photo.userID,
      mediaType: photo.mediaType,
      duration: photo.duration,
      timestamp: date.getTime(),
      timeZone,
      lat: photo.lat == null ? null : Number(photo.lat),
      lng: photo.lng == null ? null : Number(photo.lng),
      dateKey: formatInPhotoTimeZone(date, "en", timeZone, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$1-$2"),
      dateText,

      imageURL,
      thumbnailURL:
        photo.mediaType === 1
          ? resolvePhotoURL(photo.smallURL)
          : thumbnailPhotoURL(resolvePhotoURL(photo.smallURL) || imageURL),
      downloadURL: `/api/web/photos/download?photoID=${encodeURIComponent(photo.photoID)}`,
      localPhotoName: photo.localPhotoName,
      location: photo.location,
      userName: photo.userName,
      projectName: photo.projectName,
      timeText: formatDateTime(date, locale, timeZone),
    };
    const photos = grouped.get(dateText) || [];
    photos.push(item);
    grouped.set(dateText, photos);
  }
  return Array.from(grouped, ([dateText, photos]) => ({ dateText, photos }));
}

export async function getTeamGallery(groupID: string, localeInput?: string) {
  const locale = resolveLocale(localeInput);
  const snapshot = new Date().toISOString();
  const [team, photos, memberCount, photoCount] = await Promise.all([
    prisma.team.findFirst({
      where: { groupID, deletedAt: null },
      select: { groupID: true, groupName: true },
    }),
    prisma.photo.findMany({
      where: {
        AND: [
          publicPhotoWhere({ kind: "team", id: groupID }),
          { createdAt: { lte: new Date(snapshot) } },
        ],
      },
      take: 48,
      select: photoSelect,
      orderBy: [{ timestamp: "desc" }, { photoID: "desc" }],
    }),
    prisma.teamMember.count({ where: { groupID, user: { deletedAt: null } } }),
    prisma.photo.count({
      where: {
        AND: [
          publicPhotoWhere({ kind: "team", id: groupID }),
          { createdAt: { lte: new Date(snapshot) } },
        ],
      },
    }),
  ]);
  return {
    team,
    days: groupPhotosByDate(photos, locale),
    photoCount,
    snapshot,
    memberCount,
  };
}

export async function getProjectGallery(
  projectID: number,
  localeInput?: string,
) {
  const locale = resolveLocale(localeInput);
  const snapshot = new Date().toISOString();
  const project = await prisma.project.findFirst({
    where: { projectID, deletedAt: null },
    include: {
      team: { select: { groupID: true, groupName: true, deletedAt: true } },
    },
  });
  if (!project || project.team.deletedAt) {
    return { project: null, days: [], photoCount: 0, memberCount: 0, snapshot };
  }

  const [photos, memberCount, photoCount] = await Promise.all([
    prisma.photo.findMany({
      where: {
        AND: [
          publicPhotoWhere({ kind: "project", id: String(projectID) }),
          { createdAt: { lte: new Date(snapshot) } },
        ],
      },
      take: 48,
      select: photoSelect,
      orderBy: [{ timestamp: "desc" }, { photoID: "desc" }],
    }),
    prisma.teamMember.count({
      where: { groupID: project.groupID, user: { deletedAt: null } },
    }),
    prisma.photo.count({
      where: {
        AND: [
          publicPhotoWhere({ kind: "project", id: String(projectID) }),
          { createdAt: { lte: new Date(snapshot) } },
        ],
      },
    }),
  ]);

  return {
    project,
    days: groupPhotosByDate(photos, locale),
    photoCount,
    snapshot,
    memberCount,
  };
}

export async function getUserGallery(userID: string, localeInput?: string) {
  const locale = resolveLocale(localeInput);
  const snapshot = new Date().toISOString();
  const [user, photos, photoCount] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userID, deletedAt: null },
      select: {
        id: true,
        email: true,
        userName: true,
        shortName: true,
        avatar: true,
      },
    }),
    prisma.photo.findMany({
      where: {
        AND: [
          publicPhotoWhere({ kind: "user", id: userID }),
          { createdAt: { lte: new Date(snapshot) } },
        ],
      },
      take: 48,
      select: photoSelect,
      orderBy: [{ timestamp: "desc" }, { photoID: "desc" }],
    }),
    prisma.photo.count({
      where: {
        AND: [
          publicPhotoWhere({ kind: "user", id: userID }),
          { createdAt: { lte: new Date(snapshot) } },
        ],
      },
    }),
  ]);

  return {
    user,
    days: groupPhotosByDate(photos, locale),
    photoCount,
    snapshot,
  };
}
