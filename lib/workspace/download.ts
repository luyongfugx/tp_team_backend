// The direct ZIP endpoints allow 100 MB of source files plus archive overhead.
export async function readZipResponse(
  response: Response,
  signal: AbortSignal,
  onProgress: (percentage: number | undefined) => void,
  maxBytes = 102 * 1024 * 1024,
) {
  signal.throwIfAborted();
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "EXPORT_FAILED");
  }
  if (!response.body) throw new Error("FILE_UNAVAILABLE");
  const length = Number(response.headers.get("Content-Length"));
  const reader = response.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let received = 0, lastUpdate = 0;
  // Progress is local to the panel and throttled, not a photo-grid state update.
  onProgress(length > 0 ? 0 : undefined);
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) throw new Error("DIRECT_EXPORT_SIZE_LIMIT");
      parts.push(new Uint8Array(value));
      if (Date.now() - lastUpdate > 150) {
        onProgress(length > 0 ? Math.min(99, received / length * 100) : undefined);
        lastUpdate = Date.now();
      }
    }
    if (!received) throw new Error("FILE_UNAVAILABLE");
    return new Blob(parts, { type: "application/zip" });
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
