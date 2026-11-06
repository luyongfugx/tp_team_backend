/** @type {import('next').NextConfig} */
const nextConfig = {
  // Explicit local preview hosts for physical-device H5 tests. Next only uses
  // this allowlist in development; production remains on the public HTTPS host.
  allowedDevOrigins: ["127.0.0.1", ...(process.env.TP_VERIFICATION_PREVIEW_HOST ? [process.env.TP_VERIFICATION_PREVIEW_HOST] : [])],
  devIndicators: false,
  // Keep release builds within the memory budget of the shared app/OCR host.
  experimental: {
    cpus: 1,
    staticGenerationMaxConcurrency: 2,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
