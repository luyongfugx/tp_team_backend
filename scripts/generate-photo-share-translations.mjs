import fs from "node:fs"
import path from "node:path"

const sourceRoot = process.argv[2]
  || path.resolve("../gps_map_camera/iOSTimeGPS/Resource/Language")
const output = process.argv[3]
  || path.resolve("lib/photoShareTranslations.generated.json")

const fields = {
  menuTitle: "tp_photo_verification_menu_title",
  menuDetail: "tp_photo_verification_menu_detail",
  trustQuestion: "tp_photo_verification_trust_question",
  trustSubtitle: "tp_photo_verification_trust_subtitle",
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
  verifyBody: "tp_photo_verification_trust_subtitle",
  openApp: "k_download",
  downloadTitle: "tp_photo_verification_design_title",
  downloadBody: "tp_photo_verification_trust_subtitle",
  privacy: "tp_photo_verification_record_lookup_tip",
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
for (const [locale, source] of Object.entries(sourceByLocale)) {
  translations[locale] = Object.fromEntries(Object.entries(fields).map(([field, sourceKey]) => [
    field,
    source[sourceKey] || english[sourceKey] || field,
  ]))
}

Object.assign(translations.en, { photographer: "Photographer" })
Object.assign(translations["zh-Hans"] || {}, { photographer: "拍摄者" })
Object.assign(translations["zh-Hant"] || {}, { photographer: "拍攝者" })

fs.writeFileSync(output, `${JSON.stringify(translations, null, 2)}\n`)
console.log(`Generated ${Object.keys(translations).length} H5 locales at ${output}`)
