"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link, X } from "lucide-react";
import type { WorkspaceCopy } from "@/lib/workspace/i18n";
import { authenticatedFetch } from "@/lib/client-auth";
import { WorkspaceDialog } from "./dialog";

export type PhotoShare = {
  kind: "team" | "project" | "user";
  name: string;
  url: string;
  id?: string;
  groupID?: string;
};

export function SharePhotosDialog({
  share,
  t,
  onClose,
  token,
  locale,
}: {
  share: PhotoShare;
  t: WorkspaceCopy;
  onClose: () => void;
  token?: string;
  locale?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setURL] = useState(share.url);
  const [preparing, setPreparing] = useState(
    Boolean(share.id && share.groupID && token),
  );
  useEffect(() => {
    if (!share.id || !share.groupID || !token) return;
    const controller = new AbortController();
    authenticatedFetch("/api/web/photos/share", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: { kind: share.kind, id: share.id },
        groupID: share.groupID,
        locale,
      }),
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (!controller.signal.aborted)
          setURL(new URL(data.url, window.location.origin).href);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setPreparing(false);
      });
    return () => controller.abort();
  }, [share, token, locale]);
  const [status, setStatus] = useState<
    "idle" | "copying" | "copied" | "manual"
  >("idle");
  const title = t(
    share.kind === "team"
      ? "shareTeam"
      : share.kind === "project"
        ? "shareProject"
        : "shareMember",
  );
  async function copyLink() {
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(url);
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
        <div className="ws-modal-icon">
          <Link size={24} />
        </div>
        <h2>{title}</h2>
        <button type="button" aria-label={t("close")} onClick={onClose}>
          <X size={21} />
        </button>
      </header>
      <div className="ws-modal-body ws-share-body">
        <strong className="ws-share-name">{share.name}</strong>
        <p className="ws-muted">
          {t(
            share.kind === "team"
              ? "shareTeamScope"
              : share.kind === "project"
                ? "shareProjectScope"
                : "shareMemberScope",
          )}
        </p>
        <label>
          {t("shareLink")}
          <input
            ref={input}
            readOnly
            value={url}
            dir="ltr"
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
        <p className="ws-muted">{t("shareUnfiltered")}</p>
        <p
          role="status"
          aria-live="polite"
          className={status === "manual" ? "ws-inline-error" : "ws-muted"}
        >
          {status === "manual"
            ? t("shareCopyManual")
            : status === "copied"
              ? t("shareCopied")
              : ""}
        </p>
      </div>
      <footer>
        <a
          className="ws-button"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("sharePreview")}
        </a>
        <button
          type="button"
          className="ws-button ws-primary"
          disabled={preparing || status === "copying"}
          onClick={copyLink}
        >
          {status === "copied" ? <Check size={17} /> : <Copy size={17} />}
          {t(status === "copied" ? "shareCopiedButton" : "shareCopyLink")}
        </button>
      </footer>
    </WorkspaceDialog>
  );
}
