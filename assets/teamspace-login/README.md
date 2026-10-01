# Teamspace login artwork

The login page loads these files by HTTPS from the COS directory in `manifest.json`.
This directory retains the exact optimized originals for reproducible deployment.

## Sources

- Six field photos: Timeprint iOS `iOSTimeGPS/Resource/TeamSpaceSamples/`.
- Four unretouched screenshots: the Timeprint Camera Regression iOS 26.1 simulator,
  captured with `xcrun simctl io ... screenshot` on 2026-10-01.
  The real Teamspace home screen runs with the app's existing debug demo fixture;
  names, locations and account details are fixture data, not customer records.
- Screenshot languages: English (`en`), Vietnamese (`vi`), Thai (`th`), Indonesian
  (`id`). Other website languages use the English screenshot. Only one screenshot
  is requested per page; six field photos are shared across languages.

## Lossless optimization

- JPEG: mozjpeg `jpegtran -copy icc -optimize -progressive`, preserving original
  dimensions and quantization. No JPEG quality reduction or resize was performed.
- Screenshots: sharp/libwebp `webp({ lossless: true, effort: 6 })`, retaining the
  full 1206 × 2622 pixels.
- Original and optimized files were decoded with sharp to raw RGBA and compared
  byte-for-byte. All ten matched. Sizes and SHA-256 hashes are in `manifest.json`.
- Each page's artwork is 956,548–961,080 bytes (about 0.92 MiB). Mobile hides this
  decorative desktop showcase, and native lazy loading avoids its image requests.

Upload only the ten image files to the versioned COS folder; do not replace
existing versions. Uploads use COSBrowser and inherit the existing asset bucket's
permissions. Keep the component URLs and manifest in sync when publishing a new
asset version.
