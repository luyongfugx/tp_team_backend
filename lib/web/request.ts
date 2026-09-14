// Stop reading oversized public requests before allocating the whole body.
export async function readPublicRequest(req: Request): Promise<Record<string, unknown>> {
  const limit = 300000;
  if (Number(req.headers.get("content-length")) > limit || !req.body)
    throw Error("INVALID_REQUEST");
  const reader = req.body.getReader(), parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw Error("INVALID_REQUEST");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error();
    return body as Record<string, unknown>;
  } catch {
    throw Error("INVALID_REQUEST");
  }
}
