import type { WebPhoto } from "@/components/web/photo-gallery";
export type GalleryScope = { kind: "project" | "user" | "team"; id: string };
export type GalleryFilters = {
  q: string;
  project: string;
  member: string;
  from: string;
  to: string;
  type: string;
  sort: string;
};
export const defaultFilters: GalleryFilters = {
  q: "",
  project: "",
  member: "",
  from: "",
  to: "",
  type: "",
  sort: "desc",
};
export function filterGallery(photos: WebPhoto[], f: GalleryFilters) {
  const q = f.q.trim().toLocaleLowerCase();
  return photos
    .filter(
      (p) =>
        (!q ||
          [p.localPhotoName, p.location, p.userName, p.projectName].some((v) =>
            v?.toLocaleLowerCase().includes(q),
          )) &&
        (!f.project || String(p.projectID) === f.project) &&
        (!f.member || p.userID === f.member) &&
        (!f.type || String(p.mediaType) === f.type) &&
        (!f.from || p.dateKey >= f.from) &&
        (!f.to || p.dateKey <= f.to),
    )
    .sort(
      (a, b) =>
        (f.sort === "asc" ? 1 : -1) *
        (a.timestamp - b.timestamp || a.photoID.localeCompare(b.photoID)),
    );
}
export function validCoordinates<
  T extends { lat: number | null; lng: number | null },
>(p: T): p is T & { lat: number; lng: number } {
  return (
    p.lat != null &&
    p.lng != null &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}
