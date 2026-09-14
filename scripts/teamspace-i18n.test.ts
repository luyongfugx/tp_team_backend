import test from "node:test";
import assert from "node:assert/strict";
import { supportedLocales } from "../lib/i18n";
import { workspaceBaseCopy, workspaceCopy } from "../lib/workspace/i18n";
import { shareBaseCopy, shareCopy } from "../lib/web/share-copy";
import { cachedTeamspaceTranslations, isBaseTeamspaceLocale, isRTLTeamspaceLocale, loadTeamspaceTranslations } from "../lib/teamspace/translations";
import { gpsColumnLabels } from "../lib/teamspace/gps-labels";
import gpsLabels from "../lib/teamspace/gps-labels.json";

const placeholders = (text: string) => (text.match(/\{\w+\}/g) || []).sort();
const quantities = (text: string) => (text.replace(/(\d),(?=\d{3}\b)/g, "$1").match(/\d+/g) || []).filter(value => value !== "1").sort();
test("legacy Excel coordinate headers cover every supported locale", () => {
  assert.deepEqual(Object.keys(gpsLabels).sort(), [...supportedLocales].sort());
  for (const locale of supportedLocales) {
    const labels = gpsColumnLabels(locale);
    assert.equal(labels.length, 2, locale);
    for (const label of labels) {
      assert.ok(label.trim().includes("GPS"), locale);
      if (locale !== "en") assert.ok(!["GPS latitude", "GPS longitude"].includes(label), locale);
    }
  }
});
for (const locale of supportedLocales) {
  test(`${locale}: complete Team Web and share translations, unchanged placeholders and limits`, async () => {
    const pack = await loadTeamspaceTranslations(locale);
    if (isBaseTeamspaceLocale(locale)) { assert.equal(pack, undefined); return; }
    assert.ok(pack);
    for (const [namespace, base] of Object.entries({ w: workspaceBaseCopy, s: shareBaseCopy })) {
      const values: Record<string, string> = pack[namespace as "w" | "s"];
      assert.deepEqual(Object.keys(values).sort(), Object.keys(base).sort());
      for (const [key, source] of Object.entries(base)) {
        const value = values[key];
        assert.ok(typeof value === "string" && value.trim(), `${namespace}.${key}`);
        assert.equal(value, value.trim(), `${namespace}.${key}: surrounding whitespace`);
        assert.deepEqual(placeholders(value), placeholders(source[1]), `${namespace}.${key}: placeholders`);
        assert.deepEqual(quantities(value), quantities(source[1]), `${namespace}.${key}: quantities`);
        for (const token of ["Timeprint", "ZIP", "Excel", "PDF", "GPS", "KB", "MB", "GB"])
          if (source[1].includes(token)) assert.ok(value.includes(token), `${namespace}.${key}: ${token}`);
        if (source[1].split(/\s+/).length > 4)
          assert.notEqual(value, source[1], `${namespace}.${key}: English fallback`);
      }
    }
    assert.equal(workspaceCopy(locale, pack)("exportExcel"), pack.w.exportExcel);
    assert.equal(shareCopy(locale, pack)("excelViewOriginal"), pack.s.excelViewOriginal);
  });
}
test("RTL direction covers supported Arabic-script, Hebrew, Yiddish and Thaana locales", () => {
  for (const locale of ["ar", "arz", "fa", "ur", "ps", "he", "yi", "dv"]) assert.equal(isRTLTeamspaceLocale(locale), true, locale);
  for (const locale of ["en", "vi", "ku", "tr", "zh-HK"]) assert.equal(isRTLTeamspaceLocale(locale), false, locale);
});
test("preloaded language is available synchronously so switching preserves mounted downloads", async () => {
  const pack = await loadTeamspaceTranslations("de");
  assert.equal(cachedTeamspaceTranslations("de-DE"), pack);
  assert.equal(workspaceCopy("")("photo"), "Photo");
  assert.equal(shareCopy("")("photo"), "Photo");
});
