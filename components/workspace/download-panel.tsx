"use client";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Check, ChevronDown, ChevronUp, Download, LoaderCircle, X } from "lucide-react";
import { errorCopy, type WorkspaceCopy } from "@/lib/workspace/i18n";
import { readZipResponse } from "@/lib/workspace/download";

type DownloadRequest = {
  filename: string;
  count: number;
  mimeType?: string;
  request: (signal: AbortSignal) => Promise<Response>;
};
type DownloadState = {
  filename: string;
  count: number;
  phase: "preparing" | "receiving" | "started" | "failed" | "cancelled";
  progress?: number;
  url?: string;
  error?: string;
};
export type ZipDownloadHandle = { start: (options: DownloadRequest) => Promise<void> };

// Direct exports are bounded on the server. Keep the prepared ZIP or Excel file
// until dismissal so a browser-blocked automatic download can be started by hand.
export function ZipDownloadPanel({ t, ref, onBusyChange }: {
  t: WorkspaceCopy;
  ref: Ref<ZipDownloadHandle>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [task, setTask] = useState<DownloadState | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const active = useRef<AbortController | null>(null);
  const fileURL = useRef<string | null>(null);
  const retry = useRef<DownloadRequest | null>(null);
  const clearFile = () => {
    if (fileURL.current) URL.revokeObjectURL(fileURL.current);
    fileURL.current = null;
  };
  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
    clearFile();
  }, []);

  async function start(options: DownloadRequest) {
    if (active.current) return;
    clearFile();
    retry.current = options;
    const controller = new AbortController();
    active.current = controller;
    const base = { filename: options.filename, count: options.count };
    setCollapsed(false);
    setTask({ ...base, phase: "preparing" });
    try {
      const response = await options.request(controller.signal);
      const blob = await readZipResponse(response, controller.signal, progress => {
        setTask({ ...base, phase: "receiving", progress });
      }, undefined, options.mimeType);
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      fileURL.current = url;
      const link = document.createElement("a");
      link.href = url;
      link.download = options.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTask({ ...base, phase: "started", progress: 100, url });
    } catch (error) {
      if (active.current === controller) {
        setTask({ ...base, phase: controller.signal.aborted ? "cancelled" : "failed", error: error instanceof Error ? error.message : "EXPORT_FAILED" });
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }

  const busy = task?.phase === "preparing" || task?.phase === "receiving";
  useImperativeHandle(ref, () => ({ start }));
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  const panel = task && (
    <aside className="ws-download-panel" aria-label={t("downloadPanel")}>
      <header>
        <Download size={18} />
        <strong>{t("downloadPanel")}</strong>
        <button type="button" aria-label={t(collapsed ? "expandDownload" : "collapseDownload")} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {!busy && <button type="button" aria-label={t("close")} onClick={() => { clearFile(); retry.current = null; setTask(null); }}><X size={18} /></button>}
      </header>
      {!collapsed && <div className="ws-download-body">
        <div className="ws-download-file"><span>{task.filename}</span><small>{task.count} {t("items")}</small></div>
        <div role="status" className="ws-download-status">
          {busy ? <LoaderCircle size={16} className="ws-spin" /> : task.phase === "started" ? <Check size={16} /> : null}
          <span>{t(task.phase === "preparing" ? "downloadPreparing" : task.phase === "receiving" ? "downloadReceiving" : task.phase === "started" ? "downloadStarted" : task.phase === "cancelled" ? "downloadCancelled" : "downloadFailed")}</span>
        </div>
        {(busy || task.phase === "started") && <progress aria-label={t("downloadProgress")} max={100} value={task.progress} />}
        {task.phase === "started" && <p>{t("downloadBrowserHint")}</p>}
        {task.phase === "failed" && <p className="ws-inline-error">{errorCopy(t, task.error || "EXPORT_FAILED")}</p>}
        <footer>
          {busy && <button type="button" className="ws-button" onClick={() => active.current?.abort()}>{t("cancel")}</button>}
          {task.url && <a className="ws-button" href={task.url} download={task.filename}>{t("downloadAgain")}</a>}
          {(task.phase === "failed" || task.phase === "cancelled") && <button type="button" className="ws-button" onClick={() => { if (retry.current) void start(retry.current); }}>{t("retry")}</button>}
        </footer>
      </div>}
    </aside>
  );
  return panel;
}
