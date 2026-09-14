import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptySelection,
  toggleIDs,
  selectionCount,
  isSelected,
  dateBoundary,
  dateKey,
  readFilters,
  readSelection,
} from "../lib/workspace/model";
import { photoWhere } from "../lib/workspace/server";
import { sourceFile, safeName } from "../lib/workspace/files";

test("selection starts empty, survives page changes, and supports all-minus-exclusions", () => {
  let s = emptySelection();
  assert.equal(selectionCount(s, 67), 0);
  s = toggleIDs(s, ["page1-photo"], true);
  s = toggleIDs(s, ["page2-photo"], true);
  assert.equal(selectionCount(s, 67), 2);
  assert.equal(isSelected(s, "page1-photo"), true);
  s = { mode: "all", ids: [], excluded: [] };
  s = toggleIDs(s, ["page1-photo"], false);
  assert.equal(selectionCount(s, 67), 66);
  assert.equal(isSelected(s, "page1-photo"), false);
  assert.equal(isSelected(s, "page2-photo"), true);
  s = toggleIDs(s, ["page1-photo"], true);
  assert.equal(selectionCount(s, 67), 67);
});
test("date ranges use display timezone and exclusive next-day boundary including DST", () => {
  assert.equal(
    new Date(dateBoundary("2026-09-14", "Asia/Shanghai")).toISOString(),
    "2026-09-13T16:00:00.000Z",
  );
  assert.equal(
    dateBoundary("2026-03-08", "America/New_York", true) -
      dateBoundary("2026-03-08", "America/New_York"),
    23 * 3600000,
  );
  assert.equal(
    dateBoundary("2026-11-01", "America/New_York", true) -
      dateBoundary("2026-11-01", "America/New_York"),
    25 * 3600000,
  );
  assert.equal(
    dateKey(Date.parse("2026-09-13T16:00Z"), "Asia/Shanghai"),
    "2026-09-14",
  );
  assert.throws(() => dateBoundary("2026-02-30", "UTC"));
});
test("invalid filters and oversized selection are rejected before database queries", () => {
  for (const values of [
    "from=2026-09-15&to=2026-09-14",
    "tz=Moon",
    "type=3",
    "projectID=NaN",
  ])
    assert.throws(() => readFilters(new URLSearchParams(values)));
  assert.throws(() =>
    readSelection({
      mode: "ids",
      ids: new Array(2001).fill("photo"),
      excluded: [],
    }),
  );
  assert.deepEqual(
    readSelection({ mode: "ids", ids: ["p", "p"], excluded: [] }).ids,
    ["p"],
  );
});
test("ordinary-member restriction remains an AND condition even with forged member filter and IDs", () => {
  const access = {
    team: { groupID: "team", groupName: "Team" },
    userID: "self",
    canManage: false,
  };
  const where = photoWhere(
    access,
    readFilters(new URLSearchParams("userID=other")),
    { mode: "ids", ids: ["foreign-photo"], excluded: [] },
  );
  const conditions = where.AND as Record<string, unknown>[];
  assert.ok(conditions.some((c) => c.userID === "self"));
  assert.ok(conditions.some((c) => c.userID === "other"));
  assert.deepEqual(conditions[0], { groupID: "team", deletedAt: null });
  assert.ok(
    !JSON.stringify(photoWhere({ ...access, canManage: true })).includes(
      "self",
    ),
  );
});
test("download source denies unconfigured hosts and local file traversal", async () => {
  for (const source of [
    "http://127.0.0.1:3000/api/me",
    "https://unconfigured.example/photo.jpg",
    "file:///etc/passwd",
    "/workspace-demo/../../.env",
  ])
    await assert.rejects(sourceFile(source));
  assert.ok(!safeName("../../x\\file:*.jpg").includes("/"));
});
