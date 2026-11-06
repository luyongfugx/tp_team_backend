# Public photo verification

The following application endpoints do not require login:

- `POST /api/photoCode/verify/upload`: JPEG up to 800 KB; returns a random guest upload URL.
- `POST /api/photoCode/verify/task`: submit a verification image URL.
- `POST /api/photoCode/verify/task/status`: retrieve a task by its random UUID `taskID`.
- `POST /api/photoCode/verify/task/timeout`: mark a pending task as timed out by `taskID`.
- `POST /api/photoCode/record`: query the original record by its 12-character photo code.

A valid account session is optional for associating new tasks with a user and enriching
record responses with that user's team information. Invalid or missing sessions do not
block verification. Existing clients may continue sending `guestToken`; it is not required.
Treat the unguessable task ID as an access capability: keep it private and do not add a
public task-list endpoint. Existing task IDs continue to work.

Image URLs must still use HTTPS, the configured COS verification bucket, and a safe
`verify/<namespace>/<file>.jpg` path. External hosts, signed/query URLs, path traversal,
and non-JPEG files remain rejected. OCR callback secret validation, admin authentication,
photo-code issuance authentication, and COS upload credential authorization are unchanged.

## Reports and capture records

- `GET /verify/<taskID>` renders exactly that UUIDv4 task, including partial, inconclusive,
  processing and service-error outcomes. It never substitutes a later task with the same
  photo code. The existing random task identifier is the share capability; no new database
  migration is required for these pages.
- `GET /record/<photoCode>` reads the original capture record directly. It requires no prior
  upload or verification task and never displays image-verification checkmarks.
- Legacy `GET /s/<photoCode>` resolves to the latest completed task with an explicit legacy
  notice. Sharing from that page uses the resolved task URL. If there is no task, it opens
  the capture record page.
- Both pages accept `lang` and `embed=1`. Legacy `theme=light|dark` parameters remain accepted,
  but reports always use the fixed blue background, white content and state-specific header
  palette, independent of the system appearance. Embedded pages request native
  share, select-photo and copy-code actions through `timeprintVerification`. The native host
  validates the main-frame origin; arbitrary page URLs never become native share destinations.
- Report translations are generated from the complete iOS localization inventory, including
  regional resources. Missing source translations fail generation instead of falling back
  silently to English. The page follows the app-provided `lang` (or browser language when
  absent), with no language picker. Shares preserve that language; embedded navigation
  titles and direction use the same locale.
- A passed report uses the concise “Authentic” result. Its overview contains time, location
  and image checks, a bounded full-photo thumbnail and the photo code. Successful photo-code
  validation is represented by the code bar; code failures remain explicit in the check list.
- Missing per-check data remains unavailable. Unsupported checks are not checked. A failed
  OCR read, missing reference or network error is not reported as image manipulation.
- Public capture fields are allowlisted; user/device IDs, account/team enrichment, raw storage
  keys and raw error messages are not rendered. Report pages are noindex and excluded from
  automatic page-URL analytics.

For development preview only, set `TP_VERIFICATION_PREVIEW=1` and open
`/verification-preview?state=passed|mismatch|partial|record|unavailable|unsupported|error|not_found`.
The page is visibly labeled simulated, and is unavailable in production. Optional
`TP_VERIFICATION_SAMPLE_PATH` points to a local JPEG for the fixture preview. Optional
`TP_VERIFICATION_READ_API_BASE` reads existing public task/record API results in development
without production DB/COS credentials. The report streams a loading shell and displays the verification data without waiting for a photo. In this mode, the browser separately requests `/api/photoCode/verify/task/<taskID>/preview`, which redirects to the matching signed image from the official report configured by `TP_VERIFICATION_READ_REPORT_ORIGIN` (default `https://h5.timeprint.net`); only the exact image host and path returned for that task are accepted. This read-only adapter is disabled outside development (the image route returns 404). Production continues to sign its own image directly.
For a phone on the local network, set `TP_VERIFICATION_PREVIEW_HOST` to the Mac's LAN
hostname/IP and run `next dev --webpack --hostname 0.0.0.0`. The explicit development
origin allowlist permits Next's client resources without relaxing production access.
`/verification-example` is a fixed, publicly available mismatch illustration, always marked
as sample data. It cannot accept an arbitrary task or generate a real verification result.
On Fang, a Debug launch may supply `TP_VERIFY_REPORT_BASE_URL` for the local preview host.
Supply an empty value to clear that Debug override; Release always uses `https://h5.timeprint.net`.
For a user trial with real photos, use `TP_VERIFY_REAL_PHOTOS=1` with launch argument
`-TP_VERIFY_REAL_PHOTOS`, without the app-wide `TP_UI_AUDIT` flags or `TP_VERIFY_WEB_STATE`.
This scoped Debug mode enables the real verification entry and hides the example button;
it does not substitute account data or verification results. Open `timeprint://photo-verification`.
iOS 16.4 and later embed the shared report; older iOS versions retain native report and
record screens because the web framework requires Safari 16.4+. Task shares still use the
new stable report URL. The legacy-device native fallback is compile-checked, not device-tested
on an older OS in this preview.
The preview build's sample button exposes the state matrix; set `TP_VERIFY_USE_PUBLIC_SAMPLE=1`
to exercise the normal single-example flow. `TP_VERIFY_LIVE_UPLOAD=1` explicitly opts the
device test into uploading one generated negative fixture through the real verification API.

Validation: `node --import tsx --test scripts/verification-report.test.ts scripts/photo-verification-public.test.mjs`.
Deploy these routes before shipping clients that open them. New copy is generated from iOS
Localizable.strings with `npm run i18n:photo-share`; do not edit the generated JSON directly.

### Responsive and RTL checks

The report stays in one column on phones/tablets. At 960px, photo and capture details
use two columns when both are available; the three authenticity explanations use three
columns. Code-only records retain a bounded single-column detail area. All widths are
bounded so large desktop windows do not stretch paragraphs indefinitely.

Direction follows the selected locale. Photo codes, coordinates and share URLs retain
their LTR direction; photos and branding are not mirrored. The map navigation chevron
and logical page layout follow RTL. Narrow screens stack status badges and metadata
values without shrinking the brand.

In development, append `viewport=320|360|390|768|1024|1440|1920` to the preview URL to
render a same-origin frame at that real CSS viewport width. `Inspect layout` reports
horizontal overflow, offscreen content, clipped text and code direction. Also inspect
the screenshot and actual Fang WebView; these metrics alone do not prove visual quality.

## Deployment

Run `prisma migrate deploy` before rolling out the application, then regenerate the Prisma
client as part of the normal build. Migration `20260930090000_allow_guest_photo_verification`
makes `PhotoVerificationTask.userID` nullable without rewriting or deleting existing tasks.
