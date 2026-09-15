"use client";
import { viewerToken } from "@/lib/web/viewer-auth";
import { useState } from "react";
import { CopyPlus, X } from "lucide-react";
import { WorkspaceDialog } from "@/components/workspace/dialog";
import type { ShareCopy } from "@/lib/web/share-copy";
import type { WorkspaceCopy } from "@/lib/workspace/i18n";
export type CopyTargets = {
  teams: { groupID: string; groupName: string }[];
  projects: { projectID: number; projectName: string; groupID: string }[];
};
export function CopyPhotosDialog({
  targets,
  body,
  count,
  t,
  wt,
  locale,
  onClose,
}: {
  targets: CopyTargets;
  body: Record<string, unknown>;
  count: number;
  t: ShareCopy;
  wt: WorkspaceCopy;
  locale: string;
  onClose: () => void;
}) {
  const teams = targets.teams.filter((team) =>
    targets.projects.some((project) => project.groupID === team.groupID),
  );
  const sourceScope = body.scope as { kind?: string; id?: string } | undefined;
  const [team, setTeam] = useState(
    teams.find(
      (team) => sourceScope?.kind === "team" && team.groupID === sourceScope.id,
    )?.groupID ||
      teams[0]?.groupID ||
      "",
  );
  const [project, setProject] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [result, setResult] = useState<{
    copied: number;
    total: number;
    projectID: number;
    groupID: string;
  } | null>(null);
  async function copy() {
    if (busy || !project || !count || count > 200) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/web/photos/copy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${viewerToken() || ""}`,
        },
        body: JSON.stringify({
          ...body,
          expectedCount: count,
          projectID: Number(project),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setResult(data);
    } catch (e) {
      setError(
        (e as Error).message === "FORBIDDEN"
          ? wt("FORBIDDEN")
          : `${wt("failureCount")} · ${t("retry")}`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <WorkspaceDialog
      className="share-copy-dialog"
      label={t("copyTo")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <header>
        <h2>{t("copyTo")}</h2>
        <button disabled={busy} onClick={onClose} aria-label={t("close")}>
          <X />
        </button>
      </header>
      <div className="ws-modal-body">
        {result ? (
          <>
            <strong>
              {wt("successCount")} · {result.total} {t("count")}
            </strong>
            <p>
              {
                targets.projects.find((p) => p.projectID === result.projectID)
                  ?.projectName
              }
            </p>
          </>
        ) : (
          <>
            <p>
              {body.all ? t("allResults") : t("selectedOnly")} ·{" "}
              <strong>{count}</strong> {t("count")}
            </p>
            <label>
              {t("team")}
              <select
                disabled={busy}
                value={team}
                onChange={(e) => {
                  setTeam(e.target.value);
                  setProject("");
                }}
              >
                {teams.map((t) => (
                  <option key={t.groupID} value={t.groupID}>
                    {t.groupName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("copyTo")} · {t("project")}
              <select
                disabled={busy}
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">—</option>
                {targets.projects
                  .filter((p) => p.groupID === team)
                  .map((p) => (
                    <option key={p.projectID} value={p.projectID}>
                      {p.projectName}
                    </option>
                  ))}
              </select>
            </label>
            {count > 200 && <p role="alert">{t("selectedOnly")}: ≤ 200</p>}
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </div>
      <footer>
        {result ? (
          <>
            <button onClick={onClose}>{t("close")}</button>
            <a
              className="share-primary"
              href={`/workspace/${encodeURIComponent(result.groupID)}/projects/${result.projectID}?lang=${encodeURIComponent(locale)}`}
            >
              {t("excelViewPhotos")}
            </a>
          </>
        ) : (
          <>
            <button disabled={busy} onClick={onClose}>
              {t("cancel")}
            </button>
            <button
              className="share-primary"
              disabled={busy || !project || !count || count > 200}
              onClick={copy}
            >
              <CopyPlus size={17} />
              {busy ? wt("saving") : t("copyTo")}
            </button>
          </>
        )}
      </footer>
    </WorkspaceDialog>
  );
}
