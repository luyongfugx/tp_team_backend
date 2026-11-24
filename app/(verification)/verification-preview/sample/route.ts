import { readFile } from "node:fs/promises"
export async function GET() {
  if (process.env.NODE_ENV !== "development" || process.env.TP_VERIFICATION_PREVIEW !== "1" || !process.env.TP_VERIFICATION_SAMPLE_PATH) return new Response(null, { status: 404 })
  try { return new Response(await readFile(process.env.TP_VERIFICATION_SAMPLE_PATH), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } }) }
  catch { return new Response(null, { status: 404 }) }
}
