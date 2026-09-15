// Gallery previews are bounded derivatives, never the full-size download.
export function galleryImageURL(
  source: string | null | undefined,
  edge: 320 | 640,
) {
  if (!source || !/^https?:\/\//i.test(source)) return null;
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return null;
  }
  // Unknown providers may ignore transformation parameters and return the original.
  if (!/\.cos\.[a-z0-9-]+\.myqcloud\.com$/i.test(url.hostname)) return null;
  if (
    /\.(svg|gif)$/i.test(url.pathname) ||
    [...url.searchParams.keys()].some((k) => /sign|token|auth|expires/i.test(k))
  )
    return null;
  // Do not upscale an existing small derivative or stack processing commands.
  if (url.search) return null;
  return `${source}?imageMogr2/thumbnail/${edge}x${edge}%3E/quality/80`;
}
export function galleryImageSources(source: string | null | undefined) {
  const small = galleryImageURL(source, 320),
    large = galleryImageURL(source, 640);
  return small && large
    ? { src: small, srcSet: `${small} 1x, ${large} 2x` }
    : null;
}
