# Verification report fonts

These OFL-licensed subsets contain reviewed report interface text, shared by iOS WKWebView, Android WebView and browser reports. Latin text and photo codes reuse the existing Geist assets. Simplified Chinese, Traditional Chinese and Arabic-script interface text use the bundled Noto subsets to avoid OS-dependent line breaks.

The files are served from the same site; opening a report makes no Google Fonts request for these fonts. Unknown characters in user-entered addresses and names fall back to the system font. A font is downloaded only when its language is displayed (about 44–93 KiB).

After changing these translations, run `python3 scripts/build-verification-fonts.py`. This manual maintenance command sends only public interface text to Google Fonts, never photo data. Source inventories and the original OFL license for each family are included beside the font. Preserve the license files when redistributing.
