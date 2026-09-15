import test from "node:test";
import assert from "node:assert/strict";
import {
  galleryImageSources,
  galleryImageURL,
} from "../lib/web/gallery-images";
import { galleryDatePreset } from "../lib/web/date-presets";
import { copiedPhotoID } from "../lib/web/copy-photos";
test("preview derivatives are bounded, preserve signed URLs, never upscale", () => {
  const url = "https://test.cos.ap-shanghai.myqcloud.com/image.jpg";
  assert.match(galleryImageURL(url, 320)!, /320x320%3E\/quality\/80$/);
  assert.equal(
    galleryImageSources(url)?.srcSet,
    `${galleryImageURL(url, 320)} 1x, ${galleryImageURL(url, 640)} 2x`,
  );
  for (const source of [
    null,
    "/local.svg",
    "data:image/jpeg;base64,AA",
    url + "?q-signature=secret",
    url + "?imageMogr2/thumbnail/x200",
  ])
    assert.equal(galleryImageSources(source), null);
});
test("date presets respect local calendar, month/year rollover, and week start", () => {
  const now = new Date(2026, 0, 1, 0, 1);
  assert.deepEqual(galleryDatePreset("yesterday", now), {
    from: "2025-12-31",
    to: "2025-12-31",
  });
  assert.deepEqual(galleryDatePreset("month", now), {
    from: "2026-01-01",
    to: "2026-01-01",
  });
  assert.deepEqual(galleryDatePreset("week", new Date(2026, 8, 13), 1), {
    from: "2026-09-07",
    to: "2026-09-13",
  });
  assert.deepEqual(galleryDatePreset("week", new Date(2026, 8, 13), 0), {
    from: "2026-09-13",
    to: "2026-09-13",
  });
});
test("copy deduplication identifies the asset and destination, not the source row id", () => {
  const p = {
    userID: "a",
    ossFileName: "a.jpg",
    largeURL: "https://cdn/a.jpg",
    smallURL: null,
    timestamp: BigInt(10),
  };
  assert.equal(copiedPhotoID(p, 1), copiedPhotoID({ ...p }, 1));
  assert.notEqual(copiedPhotoID(p, 1), copiedPhotoID(p, 2));
  assert.notEqual(copiedPhotoID(p, 1), copiedPhotoID({ ...p, userID: "b" }, 1));
});
