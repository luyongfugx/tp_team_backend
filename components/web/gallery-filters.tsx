"use client";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { WorkspaceDialog } from "@/components/workspace/dialog";
import {
  defaultFilters,
  type GalleryFilters,
  type GalleryScope,
} from "@/lib/web/gallery";
import { galleryDatePreset, type DatePreset } from "@/lib/web/date-presets";
import type { ShareCopy } from "@/lib/web/share-copy";
import type { WorkspaceCopy } from "@/lib/workspace/i18n";
export function GalleryFiltersPanel({
  filters,
  onChange,
  projects,
  members,
  scope,
  title,
  t,
  wt,
  locale,
  mobile,
  onClose,
}: {
  filters: GalleryFilters;
  onChange: (filters: GalleryFilters) => void;
  projects: string[][];
  members: string[][];
  scope: GalleryScope;
  title: string;
  t: ShareCopy;
  wt: WorkspaceCopy;
  locale: string;
  mobile?: boolean;
  onClose: () => void;
}) {
  const [datesOpen, setDatesOpen] = useState(false);
  const change = (key: keyof GalleryFilters, value: string) =>
    onChange({ ...filters, [key]: value });
  const preset = (key: DatePreset) => {
    const l = new Intl.Locale(locale);
    const weekInfo = l as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay =
      weekInfo.getWeekInfo?.().firstDay ?? weekInfo.weekInfo?.firstDay ?? 1;
    onChange({
      ...filters,
      ...galleryDatePreset(key, new Date(), firstDay % 7),
    });
  };
  const content = (
    <div
      className="share-filter-fields"
      id={mobile ? "share-mobile-filter-controls" : "share-filter-controls"}
    >
      {mobile && (
        <select
          aria-label={t("newest")}
          value={filters.sort}
          onChange={(e) => change("sort", e.target.value)}
        >
          <option value="desc">{t("newest")}</option>
          <option value="asc">{t("oldest")}</option>
        </select>
      )}
      {scope.kind === "project" ? (
        <div className="share-fixed-filter">
          <small>{t("project")}</small>
          <strong>{title}</strong>
        </div>
      ) : (
        projects.length > 0 && (
          <label>
            {t("project")}
            <select
              value={filters.project}
              onChange={(e) => change("project", e.target.value)}
            >
              <option value="">{t("allProjects")}</option>
              {projects.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )
      )}
      {scope.kind === "user" ? (
        <div className="share-fixed-filter">
          <small>{t("member")}</small>
          <strong>{title}</strong>
        </div>
      ) : (
        members.length > 0 && (
          <label>
            {t("member")}
            <select
              value={filters.member}
              onChange={(e) => change("member", e.target.value)}
            >
              <option value="">{t("allMembers")}</option>
              {members.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )
      )}
      <label>
        {t("excelMediaType")}
        <select
          value={filters.type}
          onChange={(e) => change("type", e.target.value)}
        >
          <option value="">{t("type")}</option>
          <option value="0">{t("photo")}</option>
          <option value="1">{t("video")}</option>
        </select>
      </label>
      {!mobile && (
        <button
          className="share-desktop-dates"
          aria-expanded={datesOpen}
          onClick={() => setDatesOpen((v) => !v)}
        >
          {t("dates")}
        </button>
      )}
      {(mobile || datesOpen) && (
        <fieldset className="share-filter-dates">
          <legend>{t("dates")}</legend>
          <div className="share-date-presets">
            {(["today", "yesterday", "week", "month"] as const).map((key) => (
              <button type="button" key={key} onClick={() => preset(key)}>
                {key === "yesterday" ? t(key) : wt(key)}
              </button>
            ))}
          </div>
          <div className="share-date-inputs">
            <label>
              {t("from")}
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => change("from", e.target.value)}
              />
            </label>
            <label>
              {t("to")}
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => change("to", e.target.value)}
              />
            </label>
          </div>
          {filters.from && filters.to && filters.from > filters.to && (
            <p role="alert">{t("dateError")}</p>
          )}
        </fieldset>
      )}
      <label className="share-filter-search">
        <span>
          <Search size={16} />
          {t("search")}
        </span>
        <input
          type="search"
          value={filters.q}
          onChange={(e) => change("q", e.target.value)}
        />
      </label>
    </div>
  );
  return mobile ? (
    <WorkspaceDialog
      className="share-filter-sheet"
      label={t("filters")}
      onClose={onClose}
      initialFocus="dialog"
    >
      <header>
        <h2>{t("filters")}</h2>
        <button onClick={onClose} aria-label={t("close")}>
          <X size={22} />
        </button>
      </header>
      {content}
      <footer>
        <button
          onClick={() => onChange({ ...defaultFilters, sort: filters.sort })}
        >
          {t("clear")}
        </button>
        <button className="share-primary" onClick={onClose}>
          {t("close")}
        </button>
      </footer>
    </WorkspaceDialog>
  ) : (
    content
  );
}
export function filterChips(
  filters: GalleryFilters,
  projects: string[][],
  members: string[][],
  t: ShareCopy,
) {
  const chips: { key: keyof GalleryFilters; label: string }[] = [];
  if (filters.project)
    chips.push({
      key: "project",
      label: `${t("project")}: ${projects.find(([id]) => id === filters.project)?.[1] || filters.project}`,
    });
  if (filters.member)
    chips.push({
      key: "member",
      label: `${t("member")}: ${members.find(([id]) => id === filters.member)?.[1] || filters.member}`,
    });
  if (filters.type)
    chips.push({
      key: "type",
      label: t(filters.type === "1" ? "video" : "photo"),
    });
  if (filters.from || filters.to)
    chips.push({
      key: "from",
      label: `${t("dates")}: ${filters.from || "…"} – ${filters.to || "…"}`,
    });
  if (filters.q) chips.push({ key: "q", label: filters.q });
  return chips;
}
