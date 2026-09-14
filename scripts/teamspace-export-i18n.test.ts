import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { supportedLocales, localeDateCode } from "../lib/i18n";
import { shareCopy } from "../lib/web/share-copy";
import { isRTLTeamspaceLocale, loadTeamspaceTranslations } from "../lib/teamspace/translations";
import { teamspaceDateOptions } from "../lib/teamspace/date-format";
import { photoWorkbook } from "../lib/web/excel-photos";
import { exportGalleryURL } from "../lib/web/gallery-url";

for (const locale of supportedLocales) {
  test(`${locale}: Excel round trip preserves translated labels, links and original photo data`, async () => {
    const copy = shareCopy(locale, await loadTeamspaceTranslations(locale));
    const url = exportGalleryURL({ kind: "project", id: "22" }, locale);
    const book = await photoWorkbook({
      photos: [{ photoID: "translation-test", localPhotoName: "原始照片-é.jpg", timestamp: BigInt(Date.UTC(2026, 8, 14, 16, 30)),
        takePhotoTimezoneID: "GMT+0800", projectName: "用户项目", userName: "José", location: "现场地址", lat: null, lng: null,
        mediaType: 0, smallURL: null, largeURL: null }],
      galleryURL: url, locale, signal: new AbortController().signal, load: async () => null,
    });
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(await book.xlsx.writeBuffer() as never);
    const sheet = restored.worksheets[0];
    assert.equal(sheet.name, copy("photo"));
    assert.deepEqual((sheet.getRow(2).values as ExcelJS.CellValue[]).slice(1), [copy("photo"), copy("project"), copy("member"), copy("excelDate"), copy("excelTime"), copy("location"), copy("excelGPS"), copy("filename"), copy("excelTimezone"), copy("excelMediaType"), copy("excelViewOriginal")]);
    assert.equal(sheet.getCell("A3").value, copy("photoFailed"));
    assert.equal(sheet.getCell("B3").value, "用户项目");
    assert.equal(sheet.getCell("C3").value, "José");
    assert.equal(sheet.getCell("H3").value, "原始照片-é.jpg");
    assert.equal((sheet.getCell("D3").value as Date).toISOString(), "2026-09-15T00:30:00.000Z");
    assert.deepEqual(sheet.getCell("K3").value, { text: copy("excelViewOriginal"), hyperlink: `${url}&photo=translation-test` });
    assert.equal(!!sheet.views[0].rightToLeft, isRTLTeamspaceLocale(locale));
  });
}

test("languages without ICU date names use numeric dates with unchanged capture timezone", () => {
  for (const locale of supportedLocales) {
    const dateLocale = localeDateCode(locale);
    const options = teamspaceDateOptions(dateLocale, true);
    const date = new Date("2026-09-14T16:30:00Z");
    const text = new Intl.DateTimeFormat(dateLocale, { ...options, timeZone: "Asia/Shanghai" }).format(date);
    assert.ok(text.length > 0, locale);
    if (!Intl.DateTimeFormat.supportedLocalesOf([dateLocale]).length) {
      assert.doesNotMatch(text, /[A-Za-z]/, locale);
      assert.equal(options.hourCycle, "h23");
    }
  }
});
