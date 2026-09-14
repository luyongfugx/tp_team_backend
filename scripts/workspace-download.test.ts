import test from "node:test";
import assert from "node:assert/strict";
import { readZipResponse } from "../lib/workspace/download";

test("download preserves file bytes and uses measured progress below 100 until handoff", async () => {
  const progress: (number | undefined)[] = [];
  const bytes = new Uint8Array([80, 75, 3, 4, 0, 255]);
  const file = await readZipResponse(new Response(bytes, { headers: { "Content-Length": "6" } }), new AbortController().signal, p => progress.push(p));
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
  assert.equal(file.type, "application/zip");
  assert.equal(progress[0], 0);
  assert.ok(progress.every(p => p !== undefined && p >= 0 && p < 100));
});

test("unknown size stays indeterminate and server errors never become downloadable files", async () => {
  const progress: (number | undefined)[] = [];
  await readZipResponse(new Response("zip"), new AbortController().signal, p => progress.push(p));
  assert.ok(progress.every(p => p === undefined));
  await assert.rejects(readZipResponse(Response.json({ error: "FORBIDDEN" }, { status: 403 }), new AbortController().signal, () => {}), /FORBIDDEN/);
  await assert.rejects(readZipResponse(new Response(""), new AbortController().signal, () => {}), /FILE_UNAVAILABLE/);
});

test("Excel downloads preserve workbook bytes and the spreadsheet MIME type", async () => {
  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const bytes = new Uint8Array([80, 75, 3, 4, 0, 255]);
  const blob = await readZipResponse(new Response(bytes), new AbortController().signal, () => {}, undefined, mime);
  assert.equal(blob.type, mime);
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
});

test("oversized downloads cancel their response stream", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(9)); }, cancel() { cancelled = true; } });
  await assert.rejects(readZipResponse(new Response(stream), new AbortController().signal, () => {}, 8), /DIRECT_EXPORT_SIZE_LIMIT/);
  assert.equal(cancelled, true);
});

test("cancelling a pending read finishes promptly without returning a partial ZIP", async () => {
  let cancelled = false;
  const controller = new AbortController();
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array([80, 75])); }, cancel() { cancelled = true; } });
  const pending = readZipResponse(new Response(stream), controller.signal, () => {});
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(cancelled, true);
});
