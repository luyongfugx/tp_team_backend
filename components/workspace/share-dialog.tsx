"use client";
import { useRef, useState } from "react";
import { Check, Copy, Link, X } from "lucide-react";
import type { WorkspaceCopy } from "@/lib/workspace/i18n";
import { WorkspaceDialog } from "./dialog";

export type PhotoShare = {
  kind: "team" | "project" | "user";
  name: string;
  url: string;
};

export function SharePhotosDialog({ share, t, onClose }: {
  share: PhotoShare;
  t: WorkspaceCopy;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "manual">("idle");
  const title = t(share.kind === "team" ? "shareTeam" : share.kind === "project" ? "shareProject" : "shareMember");
  async function copyLink() {
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(share.url);
      setStatus("copied");
    } catch {
      setStatus("manual");
      input.current?.focus();
      input.current?.select();
    }
  }
  return (
    <WorkspaceDialog label={title} onClose={onClose}>
      <header>
        <div className="ws-modal-icon"><Link size={24} /></div>
        <h2>{title}</h2>
        <button type="button" aria-label={t("close")} onClick={onClose}><X size={21} /></button>
      </header>
      <div className="ws-modal-body ws-share-body">
        <strong className="ws-share-name">{share.name}</strong>
        <p className="ws-muted">
          {t(share.kind === "team" ? "shareTeamScope" : share.kind === "project" ? "shareProjectScope" : "shareMemberScope")}
        </p>
        <label>
          {t("shareLink")}
          <input ref={input} readOnly value={share.url} dir="ltr" onFocus={e => e.currentTarget.select()} />
        </label>
        <p className="ws-muted">{t("shareUnfiltered")}</p>
        <p role="status" aria-live="polite" className={status === "manual" ? "ws-inline-error" : "ws-muted"}>
          {status === "manual" ? t("shareCopyManual") : status === "copied" ? t("shareCopied") : ""}
        </p>
      </div>
      <footer>
        <a className="ws-button" href={share.url} target="_blank" rel="noopener noreferrer">{t("sharePreview")}</a>
        <button type="button" className="ws-button ws-primary" disabled={status === "copying"} onClick={copyLink}>
          {status === "copied" ? <Check size={17} /> : <Copy size={17} />}
          {t(status === "copied" ? "shareCopiedButton" : "shareCopyLink")}
        </button>
      </footer>
    </WorkspaceDialog>
  );
}
