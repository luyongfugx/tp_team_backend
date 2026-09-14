import test from "node:test";
import assert from "node:assert/strict";
import {
  filterGallery,
  defaultFilters,
  validCoordinates,
} from "../lib/web/gallery";
import { publicPhotoWhere, publicPhotoBaseWhere, readGalleryScope } from "../lib/web/public-scope";
import type { WebPhoto } from "../components/web/photo-gallery";
import { readPublicRequest } from "../lib/web/request";
const photo = (id: string, more: Partial<WebPhoto> = {}): WebPhoto => ({
  photoID: id,
  imageURL: null,
  thumbnailURL: null,
  downloadURL: "",
  localPhotoName: "现场.jpg",
  location: "上海",
  userName: "A",
  projectName: "项目",
  timeText: "",
  device: null,
  os: null,
  projectID: 1,
  userID: "a",
  mediaType: 0,
  duration: null,
  timestamp: 1,
  timeZone: "Asia/Shanghai",
  dateKey: "2026-09-14",
  dateText: "",
  lat: null,
  lng: null,
  ...more,
});
test("combined filters preserve scope and inclusive capture-date boundaries", () => {
  const data = [
    photo("1"),
    photo("2", { projectID: 2 }),
    photo("3", { userID: "b" }),
    photo("4", { mediaType: 1 }),
    photo("5", { dateKey: "2026-09-15" }),
    photo("6", { location: "北京", localPhotoName: "another.jpg" }),
  ];
  assert.deepEqual(
    filterGallery(data, {
      ...defaultFilters,
      q: "上海",
      member: "a",
      project: "1",
      type: "0",
      from: "2026-09-14",
      to: "2026-09-14",
    }).map((p) => p.photoID),
    ["1"],
  );
  assert.equal(
    filterGallery(data, {
      ...defaultFilters,
      from: "2026-09-16",
      to: "2026-09-14",
    }).length,
    0,
  );
});
test("ordering is deterministic when timestamps match, and 0 is a valid GPS coordinate", () => {
  assert.deepEqual(
    filterGallery([photo("a"), photo("b")], defaultFilters).map(
      (p) => p.photoID,
    ),
    ["b", "a"],
  );
  assert.deepEqual(
    filterGallery([photo("a"), photo("b")], {
      ...defaultFilters,
      sort: "asc",
    }).map((p) => p.photoID),
    ["a", "b"],
  );
  assert.equal(validCoordinates({ lat: 0, lng: 0 }), true);
  for (const p of [
    { lat: null, lng: 0 },
    { lat: 91, lng: 0 },
    { lat: 0, lng: 181 },
    { lat: NaN, lng: 0 },
  ])
    assert.equal(validCoordinates(p), false);
});
test("public scopes are AND-composed and exclude deleted photos, teams, projects and users", () => {
  assert.deepEqual(publicPhotoWhere({ kind: "project", id: "22" }).AND, [
    publicPhotoBaseWhere(),
    { projectID: 22 },
  ]);
  assert.deepEqual(publicPhotoWhere({ kind: "user", id: "member" }).AND, [
    publicPhotoBaseWhere(),
    { userID: "member" },
  ]);
  assert.throws(() => publicPhotoWhere({ kind: "project", id: "0" }));
  assert.throws(() => publicPhotoWhere({ kind: "project", id: "22 OR 1=1" }));
  assert.throws(() =>
    publicPhotoWhere({ kind: "project", id: "999999999999" }),
  );
});

test("collection scope rejects missing scope and Prisma query objects", () => {
  for (const scope of [undefined, null, {}, [], { kind: "team" },
    { kind: "team", id: { not: "" } }, { kind: "team", id: 1 },
    { kind: "user", id: " " }, { kind: "all", id: "x" }]) {
    assert.throws(() => readGalleryScope(scope), /INVALID_SCOPE/);
    assert.throws(() => publicPhotoWhere(scope as never), /INVALID_SCOPE/);
  }
});

test("public API rejects oversized streaming bodies even without Content-Length", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(100001)); },
    cancel() { cancelled = true; },
  });
  const request = new Request("http://127.0.0.1/api/web/photos/list", {
    method: "POST", body: stream, duplex: "half",
  } as RequestInit);
  await assert.rejects(readPublicRequest(request), /INVALID_REQUEST/);
  assert.equal(cancelled, true);
  for (const body of ["null", "[]", "{", "0"])
    await assert.rejects(readPublicRequest(new Request("http://127.0.0.1", { method: "POST", body })), /INVALID_REQUEST/);
});
