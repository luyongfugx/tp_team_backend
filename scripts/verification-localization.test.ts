import test from "node:test"
import assert from "node:assert/strict"
import translations from "../lib/photoShareTranslations.generated.json"
import locales from "../lib/photoShareLocales.generated.json"
import { getPhotoShareCopy, resolvePhotoShareLocale } from "../lib/photoShareI18n"

test("report translations cover the complete app language inventory", () => {
  assert.ok(locales.length >= 102)
  assert.equal(new Set(locales.map(item => item.locale)).size, locales.length)
  assert.deepEqual(locales.map(item => item.locale).sort(), Object.keys(translations).sort())
  for (const item of locales) {
    assert.ok(item.name.trim(), item.locale)
    assert.equal(resolvePhotoShareLocale(item.locale), item.locale)
    const copy = getPhotoShareCopy(item.locale).copy
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(translations.en).sort())
    for (const [key, value] of Object.entries(copy)) assert.ok(value.trim(), `${item.locale}/${key}`)
  }
})

test("new report explanations are translated rather than silently copied from English", () => {
  const fields = ["partialBody", "unreadable", "referenceMissing", "serviceError", "otherCamera", "reportNotFound",
    "legacyNotice", "imageUnavailable", "recordOnly", "sampleNotice", "trust1Body", "trust2Body", "trust3Body", "clearPhotoHint"] as const
  for (const item of locales.filter(item => item.locale !== "en")) {
    const copy = getPhotoShareCopy(item.locale).copy
    for (const field of fields) assert.notEqual(copy[field], translations.en[field], `${item.locale}/${field} still uses English`)
  }
})

test("regional and legacy language tags resolve to the app's existing resources", () => {
  for (const [tag, expected] of Object.entries({ zh: "zh-Hans", "zh-Hant-TW": "zh-Hant", "zh_HK": "zh-HK",
    kk: "kk-KZ", km: "km-KH", lo: "lo-LA", "ar-SA": "ar", in: "id", iw: "he", ji: "yi", tl: "fil", no: "nb" })) {
    assert.equal(resolvePhotoShareLocale(tag), expected, tag)
  }
  assert.equal(resolvePhotoShareLocale("xx;q=1,fr;q=0.8,en;q=0.5"), "fr")
  assert.equal(resolvePhotoShareLocale("ar;q=0,en;q=1"), "en")
})

test("script direction matches the native app, including Latin Kurdish", () => {
  for (const locale of ["ar", "arz", "he", "fa", "ur", "ps", "yi", "dv"]) assert.equal(getPhotoShareCopy(locale).direction, "rtl")
  for (const locale of ["ku", "zh-Hans", "de", "id", "vi"]) assert.equal(getPhotoShareCopy(locale).direction, "ltr")
})
