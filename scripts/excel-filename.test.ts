import test from "node:test";
import assert from "node:assert/strict";
import { excelExportFilename, excelResponseFilename } from "../lib/web/excel-filename";
import { downloadHeaders } from "../lib/workspace/files";

const now = Date.UTC(2026, 8, 14, 16, 30);
test("Excel names identify team, local export date and scope without duplicate team names", () => {
  assert.equal(excelExportFilename("10万日活-tp", "bricasalwilliam", "Asia/Shanghai", now), "10万日活-tp-2026-09-15-bricasalwilliam.xlsx");
  assert.equal(excelExportFilename("William Bricasal的工作区", "William Bricasal", "Asia/Shanghai", now), "William-Bricasal的工作区-2026-09-15-William-Bricasal.xlsx");
  assert.equal(excelExportFilename("团队", "团队", "UTC", now), "团队-2026-09-14.xlsx");
  assert.equal(excelExportFilename("团队", "项目.xlsx", "America/Los_Angeles", now), "团队-2026-09-14-项目.xlsx");
  assert.equal(excelExportFilename("", "", "invalid", now), "Timeprint-2026-09-14.xlsx");
});

test("Unicode, long and unsafe names retain both context and a usable XLSX extension", () => {
  for (const text of ["测".repeat(200), "📸".repeat(200), "a".repeat(200), "日本語 العربية e\u0301", "../a/b\\c:\r\n\"<>|?*"]) {
    const filename = excelExportFilename(text, text + " scope", "UTC", now);
    assert.doesNotMatch(filename, /[\x00-\x1f<>:"/\\|?*]/);
    assert.ok(!filename.startsWith("."));
    assert.ok(filename.length <= 90);
    assert.ok(Buffer.byteLength(filename) < 255);
    assert.ok(filename.endsWith(".xlsx"));
    assert.equal(excelResponseFilename(new Response(null, { headers: downloadHeaders(filename) }), "fallback.xlsx"), filename);
  }
});

test("browser download uses the server filename, with safe fallback for old or malformed headers", () => {
  for (const header of ["", "attachment; filename=old.xlsx", "attachment; filename*=UTF-8''%zz.xlsx", "attachment; filename*=UTF-8''..%2Ffile.xlsx", "attachment; filename*=UTF-8''file.zip", "attachment; filename*=UTF-8''file%0a.xlsx"]) {
    assert.equal(excelResponseFilename(new Response(null, { headers: { "Content-Disposition": header } }), "fallback.xlsx"), "fallback.xlsx");
  }
});
