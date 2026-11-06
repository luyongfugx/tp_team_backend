import { getVerificationPreviewImage } from "@/lib/publicVerificationReport"

// Local live-API adapter only. Production reports sign their own image directly.
export async function GET(_request: Request, { params }: { params: Promise<{ taskID: string }> }) {
  const image = await getVerificationPreviewImage((await params).taskID)
  return new Response(null, {
    status: image ? 302 : 404,
    headers: {
      ...(image ? { Location: image } : {}),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}
