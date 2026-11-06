import fs from "node:fs"
import path from "node:path"
import { verificationCopyOverrides } from "../lib/verificationCopyOverrides.mjs"

const sourceRoot = process.argv[2]
  || path.resolve("../gps_map_camera/iOSTimeGPS/Resource/Language")
const output = process.argv[3]
  || path.resolve("lib/photoShareTranslations.generated.json")

const fields = {
  reportTitle: "tp_photo_verification_report_compact_title",
  resultLabel: "tp_photo_verification_report_result_label",
  originalInfo: "tp_photo_verification_report_original_info",
  language: "i_swith_language",
  passedTitle: "tp_photo_verification_report_authentic",
  passedBody: "tp_photo_verification_passed_body",
  warningTitle: "tp_photo_verification_mismatch",
  warningBody: "tp_photo_verification_warning_body",
  unableTitle: "tp_photo_verification_report_unable_compact",
  clearPhotoHint: "tp_photo_verification_report_clear_photo_hint",
  unavailable: "tp_photo_verification_unavailable",
  partialTitle: "tp_photo_verification_report_unable_compact",
  partialBody: "tp_photo_verification_report_partial_body",
  unreadable: "tp_photo_verification_report_unreadable",
  referenceMissing: "tp_photo_verification_report_reference_missing",
  notChecked: "tp_photo_verification_report_not_checked",
  serviceError: "tp_photo_verification_report_service_error",
  otherCamera: "tp_photo_verification_report_other_camera",
  reportNotFound: "tp_photo_verification_report_not_found",
  legacyNotice: "tp_photo_verification_report_legacy_notice",
  imageUnavailable: "tp_photo_verification_report_image_unavailable",
  appVersion: "tp_photo_verification_report_app_version",
  completedAt: "tp_photo_verification_report_completed_at",
  recordOnly: "tp_photo_verification_report_record_only",
  share: "i_share",
  shareResult: "tp_photo_verification_share_result",
  close: "tp_photo_verification_close",
  retry: "tp_share_retry",
  uploadToVerify: "tp_photo_verification_upload_to_verify",
  recordLookupTip: "tp_photo_verification_record_lookup_tip",
  comparisonRecord: "tp_photo_verification_comparison_record_label",
  comparisonImage: "tp_photo_verification_comparison_image_label",
  tapLargeImage: "tp_photo_verification_tap_large_image",
  sampleLabel: "tp_photo_verification_simulated",
  sampleNotice: "tp_photo_verification_report_sample_notice",
  trustTitle: "tp_photo_verification_trust_title",
  trust1Title: "tp_photo_verification_trust_1_title",
  trust1Body: "tp_photo_verification_trust_1_body",
  trust2Title: "tp_photo_verification_trust_2_title",
  trust2Body: "tp_photo_verification_trust_2_body",
  trust3Title: "tp_photo_verification_trust_3_title",
  trust3Body: "tp_photo_verification_trust_3_body",
  menuTitle: "tp_photo_verification_menu_title",
  menuDetail: "tp_photo_verification_menu_detail",
  trustQuestion: "tp_photo_verification_trust_question",
  trustSubtitle: "tp_photo_verification_report_intro",
  selectPhoto: "tp_photo_verification_select_photo",
  changePhoto: "tp_photo_verification_change_photo",
  loading: "tp_photo_verification_loading",
  resultTitle: "tp_photo_verification_result_title",
  notVerified: "tp_photo_verification_not_verified",
  failedTitle: "tp_photo_verification_failed_title",
  failedMessage: "tp_photo_verification_failed_message",
  compressionFailed: "tp_photo_verification_compression_failed",
  timeout: "tp_photo_verification_timeout",
  havePhotoCode: "tp_photo_verification_have_photo_code",
  photoCodeHint: "tp_photo_verification_photo_code_hint",
  photoCodePlaceholder: "tp_photo_verification_photo_code_placeholder",
  viewRecord: "tp_photo_verification_view_record",
  checkingTitle: "tp_photo_verification_checking_title",
  recordFoundTitle: "tp_photo_verification_record_found_title",
  recordFoundBody: "tp_photo_verification_record_found_body",
  invalidPhotoCode: "tp_photo_verification_invalid_photo_code",
  recordNotFound: "tp_photo_verification_record_not_found",
  uploadedPhoto: "tp_photo_verification_photo_content",
  verified: "tp_photo_verification_verified",
  inconsistent: "tp_photo_verification_mismatch",
  location: "tp_photo_verification_capture_location",
  navigate: "tp_team_feed_map_google",
  gps: "tp_photo_verification_gps",
  gpsDetail: "tp_photo_verification_gps",
  positionType: "tp_photo_verification_category_location",
  accuracy: "tp_photo_verification_location_accuracy",
  verificationDetails: "tp_photo_verification_verification_details",
  allVerified: "tp_photo_verification_all_verified",
  partiallyVerified: "tp_photo_verification_mismatch",
  match: "tp_photo_verification_match",
  mismatch: "tp_photo_verification_mismatch",
  none: "tp_photo_verification_none",
  photoCode: "tp_photo_verification_record_code",
  captureTime: "tp_photo_verification_record_time",
  time: "k_time",
  date: "fix_pdf_date",
  captureLocation: "tp_photo_verification_record_location",
  photoContent: "tp_photo_verification_photo_content",
  contentMatched: "tp_photo_verification_content_match",
  contentMismatched: "tp_photo_verification_mismatch",
  timezone: "tp_photo_verification_timezone",
  deviceModel: "tp_photo_verification_device_model",
  systemVersion: "tp_photo_verification_system_version",
  captureSource: "tp_photo_verification_capture_source",
  team: "tp_photo_verification_team",
  project: "tp_photo_verification_project",
  conclusion: "tp_photo_verification_verification_conclusion",
  workReference: "tp_photo_verification_work_reference",
  reviewRequired: "tp_photo_verification_mismatch",
  captureRecord: "tp_photo_verification_photo_record",
  photographer: "fix_pdf_author",
  deviceSource: "tp_photo_verification_record_device",
  compressedTip: "tp_photo_verification_compressed_tip",
  verifyTitle: "tp_photo_verification_design_title",
  verifyBody: "tp_photo_verification_report_intro",
  openApp: "k_download",
  downloadTitle: "tp_photo_verification_design_title",
  downloadBody: "tp_photo_verification_report_intro",
  privacy: "tp_photo_verification_record_lookup_tip",
  copyLink: "kk_copy_link_btn",
  copied: "kk_copied",
  cancel: "kk_cancel",
  invalidDimensions: "tp_photo_verification_precheck_dimensions",
  missingBrand: "tp_photo_verification_precheck_brand_missing",
}

function decodeStringsValue(value) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\")
}

function readStrings(file) {
  const entries = {}
  const source = fs.readFileSync(file, "utf8")
  const pattern = /^\s*"((?:\\.|[^"])*)"\s*=\s*"((?:\\.|[^"])*)"\s*;/gm
  for (const match of source.matchAll(pattern)) {
    entries[decodeStringsValue(match[1])] = decodeStringsValue(match[2])
  }
  return entries
}

const localeDirs = fs.readdirSync(sourceRoot)
  .filter((name) => name.endsWith(".lproj"))
  .sort((left, right) => left.localeCompare(right))

const sourceByLocale = Object.fromEntries(localeDirs.map((directory) => {
  const locale = directory.slice(0, -".lproj".length)
  return [locale, readStrings(path.join(sourceRoot, directory, "Localizable.strings"))]
}))

const english = sourceByLocale.en
if (!english) throw new Error("English localization is required")

const translations = {}
// The checked-in H5 catalog can be newer than a developer's native checkout.
// Explicit extension mode preserves its reviewed strings, never falls back to English.
const previous = process.argv.includes("--extend-existing") ? JSON.parse(fs.readFileSync(output, "utf8")) : {}
for (const [locale, source] of Object.entries(sourceByLocale)) {
  translations[locale] = Object.fromEntries(Object.entries(fields).map(([field, sourceKey]) => [
    field,
    (field === "warningTitle" ? source[sourceKey] : previous[locale]?.[field]) || source[sourceKey] || (() => { throw new Error(`Missing translation: ${locale}/${sourceKey}`) })(),
  ]))
}

Object.assign(translations.en, { photographer: "Photographer" })
Object.assign(translations["zh-Hans"] || {}, { photographer: "拍摄者" })
Object.assign(translations["zh-Hant"] || {}, { photographer: "拍攝者" })
for (const [locale, copy] of Object.entries(verificationCopyOverrides)) Object.assign(translations[locale], copy)

fs.writeFileSync(output, `${JSON.stringify(translations, null, 2)}\n`)
// Use the same complete locale inventory as the app, including regional variants.
// Resolve autonyms during generation to avoid browser/server ICU differences.
const nativeNames = { arz: "عربى مصرى", dv: "ދިވެހި", ht: "Kreyòl ayisyen", ny: "Chichewa" }
const catalog = Object.keys(translations).map(locale => ({
  locale,
  name: nativeNames[locale] || new Intl.DisplayNames([locale], { type: "language" }).of(locale),
}))
fs.writeFileSync(path.join(path.dirname(output), "photoShareLocales.generated.json"), `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Generated ${Object.keys(translations).length} H5 locales at ${output}`)
