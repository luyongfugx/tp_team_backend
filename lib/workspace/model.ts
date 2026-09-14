// Shared, serializable query and selection contract. Dates use the displayed zone.
export type PhotoFilters = {
  q: string;
  projectID: string;
  userID: string;
  from: string;
  to: string;
  type: string;
  tz: string;
};
export type Selection = {
  mode: "ids" | "all";
  ids: string[];
  excluded: string[];
};
export const emptySelection = (): Selection => ({
  mode: "ids",
  ids: [],
  excluded: [],
});
export const isSelected = (s: Selection, id: string) =>
  s.mode === "all" ? !s.excluded.includes(id) : s.ids.includes(id);
export function toggleIDs(
  s: Selection,
  ids: string[],
  selected: boolean,
): Selection {
  const values = new Set(s.mode === "all" ? s.excluded : s.ids);
  for (const id of ids)
    (s.mode === "all" ? !selected : selected)
      ? values.add(id)
      : values.delete(id);
  return s.mode === "all"
    ? { ...s, excluded: [...values] }
    : { ...s, ids: [...values] };
}
export const selectionCount = (s: Selection, total: number) =>
  s.mode === "all" ? Math.max(0, total - s.excluded.length) : s.ids.length;
export function dateKey(timestamp: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const p = (key: string) => parts.find((x) => x.type === key)?.value;
  return `${p("year")}-${p("month")}-${p("day")}`;
}
export function dateBoundary(value: string, tz: string, nextDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_FILTER");
  const [y, m, d] = value.split("-").map(Number);
  const original = Date.UTC(y, m - 1, d);
  if (new Date(original).toISOString().slice(0, 10) !== value)
    throw new Error("INVALID_FILTER");
  const target = original + (nextDay ? 86400000 : 0);
  let result = target;
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 4; i++) {
    const parts = format.formatToParts(result);
    const p = (key: string) => Number(parts.find((x) => x.type === key)?.value);
    const displayed = Date.UTC(
      p("year"),
      p("month") - 1,
      p("day"),
      p("hour"),
      p("minute"),
      p("second"),
    );
    const delta = target - displayed;
    result += delta;
    if (!delta) break;
  }
  return result;
}
export function readFilters(params: URLSearchParams): PhotoFilters {
  const f = Object.fromEntries(
    ["q", "projectID", "userID", "from", "to", "type", "tz"].map((k) => [
      k,
      params.get(k) || "",
    ]),
  ) as PhotoFilters;
  f.tz ||= "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: f.tz }).format();
  } catch {
    throw new Error("INVALID_FILTER");
  }
  if (
    f.q.length > 200 ||
    f.userID.length > 100 ||
    (f.projectID &&
      (!/^[1-9]\d*$/.test(f.projectID) ||
        !Number.isSafeInteger(Number(f.projectID)) ||
        Number(f.projectID) > 2147483647)) ||
    !["", "0", "1"].includes(f.type)
  )
    throw new Error("INVALID_FILTER");
  if (f.from) dateBoundary(f.from, f.tz);
  if (f.to) dateBoundary(f.to, f.tz, true);
  if (f.from && f.to && f.from > f.to) throw new Error("INVALID_FILTER");
  return f;
}
export function readSelection(value: unknown): Selection {
  if (!value || typeof value !== "object") throw new Error("INVALID_SELECTION");
  const s = value as Selection;
  if (!["ids", "all"].includes(s.mode)) throw new Error("INVALID_SELECTION");
  for (const list of [s.ids, s.excluded])
    if (
      !Array.isArray(list) ||
      list.length > 2000 ||
      list.some((x) => typeof x !== "string" || !x || x.length > 100)
    )
      throw new Error("INVALID_SELECTION");
  return {
    mode: s.mode,
    ids: [...new Set(s.ids)],
    excluded: [...new Set(s.excluded)],
  };
}
export type WorkspacePhoto = {
  photoID: string;
  projectID: number | null;
  userID: string;
  timestamp: number;
  mediaType: number;
  duration: number | null;
  imageURL: string | null;
  thumbnailURL: string | null;
  localPhotoName: string | null;
  userName: string | null;
  projectName: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  timeZone: string;
  photoCode: string | null;
  device: string | null;
  os: string | null;
};
export type WorkspaceProject = {
  projectID: number;
  projectName: string;
  address: string | null;
  count: number;
  latest: number | null;
  covers: string[];
  memberCount: number;
};
export type WorkspaceMember = {
  userID: string;
  name: string;
  avatar: string | null;
  role: string;
  count: number;
  latest: number | null;
  covers: string[];
};
export type WorkspaceData = {
  currentUser?: { id: string; name: string; email: string | null; avatar: string | null };
  backgroundExports?: boolean;
  teams: { groupID: string; groupName: string }[];
  current: { groupID: string; groupName: string } | null;
  canManage: boolean;
  isSuperAdmin: boolean;
  projects: WorkspaceProject[];
  members: WorkspaceMember[];
  photoCount: number;
};
export type ExportJob = {
  id: string;
  title: string;
  status: string;
  total: number;
  processed: number;
  succeeded: number;
  failures: { photoID: string; reason: string }[] | null;
  error: string | null;
  createdAt: string;
  expiresAt: string | null;
  groupBy: string;
  timeZone: string;
};
