"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Camera,
  Download,
  FileSpreadsheet,
  Printer,
  Link2,
  LayoutGrid,
  Table2,
  Map as MapIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  ImageOff,
  Play,
  Globe2,
  Folder,
  Users,
  User,
  LoaderCircle,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import { SharedPhotoPreview } from "./mobile-photo-preview";
import { AdaptiveLanguageSelect } from "@/components/adaptive-language-select";
import { WorkspaceDialog } from "@/components/workspace/dialog";
import { ZipDownloadPanel, type ZipDownloadHandle } from "@/components/workspace/download-panel";
import { workspaceCopy } from "@/lib/workspace/i18n";
import { shareCopy } from "@/lib/web/share-copy";
import { useTeamspaceTranslations, TranslationLoading } from "@/lib/teamspace/use-translations";
import { isRTLTeamspaceLocale, type TeamspaceTranslations } from "@/lib/teamspace/translations";
import {
  defaultFilters,
  filterGallery,
  type GalleryFilters,
  type GalleryScope,
} from "@/lib/web/gallery";
import type { WorkspacePhoto } from "@/lib/workspace/model";
import dynamic from "next/dynamic";
import { GalleryPerformanceProbe } from "./gallery-performance-probe";
import { useGalleryPages } from "./use-gallery-pages";
const PhotoMap = dynamic(() => import("./photo-map").then((m) => m.PhotoMap), {
  ssr: false,
});
import "../workspace/workspace.css";
import "./photo-gallery.css";
export type WebPhoto = {
  photoID: string;
  imageURL: string | null;
  thumbnailURL: string | null;
  downloadURL: string;
  localPhotoName: string | null;
  location: string | null;
  userName: string | null;
  projectName: string | null;
  timeText: string;
  device: string | null;
  os: string | null;
  projectID: number | null;
  userID: string;
  mediaType: number;
  duration: number | null;
  timestamp: number;
  timeZone: string;
  dateKey: string;
  dateText: string;
  lat: number | null;
  lng: number | null;
};
export type WebPhotoDay = { dateText: string; photos: WebPhoto[] };
type GalleryHeader = {
  title: string;
  subtitle: string;
  subtitleLines?: string[];
  meta: string;
};
export type GalleryLabels = {
  back: string;
  noPhotos: string;
  noPhotosHint: string;
  viewLarge: string;
  teamPhoto: string;
  downloadImage: string;
  close: string;
  download: string;
  largeImage: string;
  open: string;
  bannerTitle: string;
  bannerSubtitle: string;
};
const PAGE_SIZE = 48;
function Checkbox({
  checked,
  mixed,
  label,
  onChange,
  disabled,
}: {
  disabled?: boolean;
  checked: boolean;
  mixed?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(mixed);
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}
function Thumb({ photo, label }: { photo: WebPhoto; label: string }) {
  const [failed, setFailed] = useState(false);
  return photo.thumbnailURL && !failed ? (
    <img
      src={photo.thumbnailURL}
      alt={photo.localPhotoName || label}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="share-thumb-failed">
      <ImageOff size={25} />
      <small>{label}</small>
    </span>
  );
}
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function WebPhotoGallery({
  header,
  days,
  initialTotal,
  initialSnapshot,
  labels,
  currentLocale,
  languageOptions,
  scope,
  initialTranslations,
}: {
  header: GalleryHeader;
  days: WebPhotoDay[];
  initialTotal: number;
  initialSnapshot: string;
  labels: GalleryLabels;
  currentLocale: string;
  languageOptions: { value: string; label: string }[];
  scope: GalleryScope;
  initialTranslations?: TeamspaceTranslations;
}) {
  const translations = useTeamspaceTranslations(currentLocale, initialTranslations);
  const t = useMemo(() => shareCopy(currentLocale, translations.data), [currentLocale, translations.data]),
    wt = useMemo(() => workspaceCopy(currentLocale, translations.data), [currentLocale, translations.data]);
  const zipDownloadRef = useRef<ZipDownloadHandle>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const allPhotos = useMemo(() => days.flatMap((day) => day.photos), [days]);
  const [filters, setFilters] = useState<GalleryFilters>(defaultFilters),
    [view, setView] = useState("gallery"),
    [page, setPage] = useState(1),
    [ready, setReady] = useState(false);
  const [selectedIDs, setSelectedIDs] = useState<Set<string>>(new Set()),
    [allSelected, setAllSelected] = useState(false),
    [excluded, setExcluded] = useState<Set<string>>(new Set()),
    [activeID, setActiveID] = useState<string | null>(null),
    [dateOpen, setDateOpen] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false);
  const selectionEpoch = useRef(0),
    dayRequests = useRef(new Map<string, number>()),
    selectionMode = useRef(allSelected);
  selectionMode.current = allSelected;
  const [notice, setNotice] = useState(""),
    [exportFormat, setExportFormat] = useState<"zip" | "xlsx" | "print" | null>(
      null,
    ),
    [range, setRange] = useState("all"),
    [busy, setBusy] = useState(false),
    [printPhotos, setPrintPhotos] = useState<WebPhoto[]>([]);
  const abort = useRef<AbortController | null>(null),
    pushedPhoto = useRef(false),
    printRoot = useRef<HTMLDivElement>(null);
  const paging = useGalleryPages(
    scope,
    allPhotos,
    initialTotal,
    initialSnapshot,
    filters,
    page,
    currentLocale,
    ready,
  );
  const { data, loading, error, facets } = paging;
  const dataBusy = loading || error;
  const photos = data.photos,
    total = data.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE)),
    currentPage = page;
  const visible = photos;
  const groups = useMemo(() => [...MapGroup(visible).entries()], [visible]);
  const dayPhotos = (date: string) => photos.filter((p) => p.dateText === date);
  const projects = facets.projects.length
    ? facets.projects
    : [
        ...new Map(
          allPhotos
            .filter((p) => p.projectID != null)
            .map((p) => [
              String(p.projectID),
              p.projectName || String(p.projectID),
            ]),
        ).entries(),
      ];
  const members = facets.members.length
    ? facets.members
    : [
        ...new Map(
          allPhotos.map((p) => [p.userID, p.userName || "—"]),
        ).entries(),
      ];
  const selected = {
    size: allSelected ? Math.max(0, total - excluded.size) : selectedIDs.size,
    has: (id: string) =>
      allSelected ? !excluded.has(id) : selectedIDs.has(id),
  };
  function setSelected(ids: Set<string>) {
    selectionEpoch.current++;
    dayRequests.current.clear();
    setSelectedIDs(ids);
    setAllSelected(false);
    setExcluded(new Set());
  }
  const hasFilters = Object.entries(filters).some(
    ([k, v]) => k !== "sort" && Boolean(v),
  );
  const [focusedPhoto, setFocusedPhoto] = useState<WebPhoto | null>(null);
  const active =
    paging.preview.find((p) => p.photoID === activeID) ||
    (focusedPhoto?.photoID === activeID ? focusedPhoto : null);
  useEffect(() => {
    if (
      !activeID ||
      dataBusy ||
      paging.preview.some((p) => p.photoID === activeID)
    )
      return;
    const controller = new AbortController();
    fetch("/api/web/photos/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        filters,
        snapshot: paging.snapshot.current,
        mode: "focused",
        photoID: activeID,
        locale: currentLocale,
      }),
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.photos[0]) {
          setFocusedPhoto(result.photos[0]);
          setPage(result.page);
        } else {
          setActiveID(null);
          setNotice(t("photoFailed"));
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [activeID, dataBusy, paging.preview]);
  const previewPhotos = useMemo(
    () =>
      [
        ...paging.preview,
        ...(focusedPhoto &&
        !paging.preview.some((p) => p.photoID === focusedPhoto.photoID)
          ? [focusedPhoto]
          : []),
      ].map((p) => ({ ...p, photoCode: null })),
    [paging.preview, focusedPhoto],
  );
  const exportCount =
    range === "selected"
      ? selected.size
      : range === "page"
        ? visible.length
        : total;
  const selectionBody = () => ({
    scope,
    filters,
    snapshot: paging.snapshot.current,
    all: range === "all" || (range === "selected" && allSelected),
    excluded: range === "selected" ? [...excluded] : [],
    ids: range === "page" ? visible.map((p) => p.photoID) : [...selectedIDs],
    locale: currentLocale,
    expectedCount: exportCount,
  });
  const maxExport = 200;
  useEffect(() => {
    const read = () => {
      const q = new URLSearchParams(window.location.search);
      const f = { ...defaultFilters };
      for (const key of Object.keys(f) as (keyof GalleryFilters)[])
        f[key] = q.get(key) || defaultFilters[key];
      const prior = JSON.parse(filterIdentity.current);
      if (
        Object.keys(f).some(
          (k) => k !== "sort" && prior[k] !== f[k as keyof GalleryFilters],
        )
      )
        setSelected(new Set());
      setFilters(f);
      setView(
        ["gallery", "table", "map"].includes(q.get("view") || "")
          ? q.get("view")!
          : "gallery",
      );
      setPage(
        /^\d{1,6}$/.test(q.get("page") || "")
          ? Math.max(1, Number(q.get("page")))
          : 1,
      );
      setActiveID(q.get("photo"));
      setReady(true);
    };
    read();
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("popstate", read);
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== defaultFilters[key as keyof GalleryFilters])
        url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (view !== "gallery") url.searchParams.set("view", view);
    else url.searchParams.delete("view");
    if (currentPage > 1) url.searchParams.set("page", String(currentPage));
    else url.searchParams.delete("page");
    window.history.replaceState(window.history.state, "", url);
  }, [filters, view, currentPage, ready]);
  useEffect(() => {
    if (!loading && !error && data.page !== page) setPage(data.page);
  }, [data, loading, error]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  function changeFilter(key: keyof GalleryFilters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
    if (key !== "sort") {
      setSelected(new Set());
      setFocusedPhoto(null);
    }
  }
  function choose(ids: string[], checked: boolean, manual = true) {
    if (manual) selectionEpoch.current++;
    if (selectionMode.current)
      setExcluded((old) => {
        const next = new Set(old);
        for (const id of ids) checked ? next.delete(id) : next.add(id);
        return next;
      });
    else
      setSelectedIDs((old) => {
        const next = new Set(old);
        for (const id of ids) checked ? next.add(id) : next.delete(id);
        return next;
      });
  }
  const filterIdentity = useRef(JSON.stringify(filters));
  filterIdentity.current = JSON.stringify(filters);
  async function chooseDay(date: string, checked: boolean, download = false) {
    const day = dayPhotos(date)[0]?.dateKey;
    if (!day) return;
    const identity = filterIdentity.current,
      epoch = selectionEpoch.current,
      request = (dayRequests.current.get(day) || 0) + 1;
    dayRequests.current.set(day, request);
    try {
      const r = await fetch("/api/web/photos/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          filters,
          snapshot: paging.snapshot.current,
          mode: "day",
          day,
        }),
      });
      if (!r.ok) throw Error();
      const { ids } = await r.json();
      if (
        identity !== filterIdentity.current ||
        epoch !== selectionEpoch.current || dayRequests.current.get(day) !== request
      )
        return;
      if (download) {
        setSelected(new Set(ids));
        setRange("selected");
        setExportFormat("zip");
      } else choose(ids, checked, false);
    } catch {
      setNotice(t("selectionLimit"));
    }
  }
  function openPhoto(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("photo", id);
    if (!activeID) {
      window.history.pushState(window.history.state, "", url);
      pushedPhoto.current = true;
    } else window.history.replaceState(window.history.state, "", url);
    setActiveID(id);
  }
  function closePhoto() {
    setActiveID(null);
    if (pushedPhoto.current) {
      pushedPhoto.current = false;
      window.history.back();
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete("photo");
      window.history.replaceState(window.history.state, "", url);
    }
  }
  function openExport(format: "zip" | "xlsx" | "print") {
    setRange(selected.size ? "selected" : "all");
    setExportFormat(format);
  }
  async function singleDownload(p: WorkspacePhoto) {
    try {
      const response = await fetch(
        `/api/web/photos/download?photoID=${encodeURIComponent(p.photoID)}`,
      );
      if (!response.ok) throw new Error();
      saveBlob(
        await response.blob(),
        p.localPhotoName || `${p.photoID}.${p.mediaType === 1 ? "mp4" : "jpg"}`,
      );
      setNotice(t("saved"));
    } catch {
      setNotice(t("failed"));
    }
  }
  async function startExport() {
    if (!exportCount || exportCount > maxExport || dataBusy || zipBusy) return;
    if (exportFormat === "zip") {
      const body = JSON.stringify({ ...selectionBody(), format: "zip", locale: currentLocale });
      setExportFormat(null);
      await zipDownloadRef.current?.start({
        filename: `${header.title.replace(/[\\/:*?"<>|]/g, "_")}.zip`,
        count: exportCount,
        request: signal => fetch("/api/web/photos/export", {
          method: "POST", headers: { "Content-Type": "application/json" }, body, signal,
        }),
      });
      return;
    }
    if (exportFormat === "print") {
      setBusy(true);
      abort.current = new AbortController();
      const signal = abort.current.signal;
      try {
        const r = await fetch("/api/web/photos/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...selectionBody(), mode: "selection" }),
          signal,
        });
        if (!r.ok) throw Error();
        const result = await r.json();
        if (signal.aborted) return;
        setPrintPhotos(result.photos);
      } catch {
        if (signal.aborted) return;
        setBusy(false);
        setNotice(t("failed"));
        return;
      }
      // Wait for React to commit the printable content, then wait for its images.
      requestAnimationFrame(() =>
        requestAnimationFrame(async () => {
          const images = [
            ...(printRoot.current?.querySelectorAll("img") || []),
          ];
          await Promise.race([
            Promise.all(images.map((img) => img.decode().catch(() => {}))),
            new Promise((resolve) => setTimeout(resolve, 15000)),
          ]);
          if (signal.aborted) return;
          setBusy(false);
          setExportFormat(null);
          // Let the dialog unmount and release its body scroll lock first.
          requestAnimationFrame(() => {
            if (!signal.aborted) window.print();
          });
        }),
      );
      return;
    }
    setBusy(true);
    abort.current = new AbortController();
    try {
      const response = await fetch("/api/web/photos/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectionBody(),
          format: exportFormat,
          includeImages: true,
          locale: currentLocale,
        }),
        signal: abort.current.signal,
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.error || "EXPORT_FAILED");
      }
      saveBlob(
        await response.blob(),
        `${header.title.replace(/[\\/:*?"<>|]/g, "_")}.${exportFormat}`,
      );
      setExportFormat(null);
      setNotice(t("saved"));
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        const code = (e as Error).message;
        setNotice(t(code === "EXPORT_BUSY" ? "exportBusy" : code === "EXPORT_TIMEOUT" ? "exportTimeout" : "excelFailed"));
      }
    } finally {
      setBusy(false);
    }
  }
  function closeExport() {
    abort.current?.abort();
    setBusy(false);
    setExportFormat(null);
  }
  const changeLanguage = (locale: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", locale);
    window.location.assign(url);
  };
  const icon =
    scope.kind === "project" ? (
      <Folder />
    ) : scope.kind === "user" ? (
      <User />
    ) : (
      <Users />
    );
  if (!translations.ready) return <TranslationLoading locale={currentLocale} failed={translations.failed} />;
  return (
    <main
      className="share-page"
      lang={currentLocale}
      dir={isRTLTeamspaceLocale(currentLocale) ? "rtl" : "ltr"}
    >
      <GalleryPerformanceProbe />
      <ZipDownloadPanel ref={zipDownloadRef} t={wt} onBusyChange={setZipBusy} />
      <div className="share-shell">
        <header className="share-brand">
          <a href="https://www.timeprint.net">
            <img src="/logo.png" alt="" />
            <strong>Timeprint</strong>
            <span>{t("shared")}</span>
          </a>
          <label>
            <Globe2 size={16} />
            <AdaptiveLanguageSelect
              aria-label={t("language")}
              value={currentLocale}
              options={languageOptions}
              onChange={(e) => changeLanguage(e.target.value)}
            />
          </label>
        </header>
        <section className="share-heading">
          <div className="share-scope">
            {icon}
            <span>
              {t(scope.kind === "user" ? "member" : scope.kind)} · {t("photo")}
            </span>
          </div>
          <h1>{header.title}</h1>
          <div className="share-subtitle">
            {(header.subtitleLines?.length
              ? header.subtitleLines
              : [header.subtitle]
            )
              .filter(Boolean)
              .map((line, i) => (
                <span key={i}>{line}</span>
              ))}
          </div>
          <p className="share-meta">{header.meta}</p>
        </section>
        <div className="share-controls" data-filters-open={filtersOpen}>
        <div className="share-actions">
          <button
            className="share-primary"
            disabled={dataBusy || !total}
            onClick={() => openExport("zip")}
          >
            <Download size={17} />
            {t("download")}
          </button>
          <button
            disabled={dataBusy || !total}
            onClick={() => openExport("xlsx")}
          >
            <FileSpreadsheet size={17} />
            {t("excel")}
          </button>
          <button
            disabled={dataBusy || !total}
            onClick={() => openExport("print")}
          >
            <Printer size={17} />
            {t("pdf")}
          </button>
          <button
            className="share-copy"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                setNotice(t("copied"));
              } catch {
                setNotice(t("copyFailed"));
              }
            }}
          >
            <Link2 size={17} />
            {t("link")}
          </button>
        </div>
        <div className="share-toolbar">
          <div className="share-tabs" role="tablist" aria-label={t("gallery")}>
            {(
              [
                ["gallery", <LayoutGrid size={17} />],
                ["table", <Table2 size={17} />],
                ["map", <MapIcon size={17} />],
              ] as [string, ReactNode][]
            ).map(([key, ico]) => (
              <button
                key={key}
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
              >
                {ico}
                {t(key as "gallery" | "table" | "map")}
              </button>
            ))}
          </div>
          <button
            className={`share-filter-toggle ${hasFilters ? "is-filtered" : ""}`}
            aria-label={t("filters")}
            title={t("filters")}
            aria-expanded={filtersOpen}
            aria-controls="share-filter-controls"
            onClick={() => setFiltersOpen(value => !value)}
          >
            <SlidersHorizontal size={19} />
            {hasFilters && <span className="share-filter-dot" />}
          </button>
          <div id="share-filter-controls" className="share-filter-controls">
          <div className="share-filters">
            <select
              aria-label={t("project")}
              value={filters.project}
              onChange={(e) => changeFilter("project", e.target.value)}
            >
              <option value="">{t("allProjects")}</option>
              {projects.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label={t("member")}
              value={filters.member}
              onChange={(e) => changeFilter("member", e.target.value)}
            >
              <option value="">{t("allMembers")}</option>
              {members.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <button
              aria-expanded={dateOpen}
              className={filters.from || filters.to ? "is-filtered" : ""}
              onClick={() => setDateOpen((v) => !v)}
            >
              <SlidersHorizontal size={15} />
              {t("dates")}
            </button>
            <select
              aria-label={t("type")}
              value={filters.type}
              onChange={(e) => changeFilter("type", e.target.value)}
            >
              <option value="">{t("type")}</option>
              <option value="0">{t("photo")}</option>
              <option value="1">{t("video")}</option>
            </select>
          </div>
          <label className="share-search">
            <Search size={16} />
            <input
              aria-label={t("search")}
              placeholder={t("search")}
              value={filters.q}
              onChange={(e) => changeFilter("q", e.target.value)}
            />
          </label>
          </div>
        </div>
        {dateOpen && (
          <div className="share-dates">
            <label>
              {t("from")}
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onInput={(e) => changeFilter("from", e.currentTarget.value)}
                onChange={(e) => changeFilter("from", e.target.value)}
              />
            </label>
            <span>—</span>
            <label>
              {t("to")}
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onInput={(e) => changeFilter("to", e.currentTarget.value)}
                onChange={(e) => changeFilter("to", e.target.value)}
              />
            </label>
            <button aria-label={t("close")} onClick={() => setDateOpen(false)}>
              <X size={17} />
            </button>
            {filters.from && filters.to && filters.from > filters.to && (
              <p role="alert">{t("dateError")}</p>
            )}
          </div>
        )}
        </div>
        <div className="share-result-bar">
          <div>
            <Checkbox
              checked={total > 0 && selected.size === total}
              mixed={selected.size > 0 && selected.size < total}
              label={t("selectAll")}
              disabled={dataBusy}
              onChange={(value) => {
                selectionEpoch.current++;
                setSelectedIDs(new Set());
                setExcluded(new Set());
                setAllSelected(value);
              }}
            />
            <span>
              {selected.size
                ? `${t("selected")} ${selected.size}`
                : `${total} ${t("count")}`}
            </span>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())}>
                {t("deselect")}
              </button>
            )}
            {hasFilters && (
              <button
                onClick={() => {
                  setFilters(defaultFilters);
                  setSelected(new Set());
                  setPage(1);
                }}
              >
                {t("clear")}
                <X size={13} />
              </button>
            )}
          </div>
          <select
            aria-label={t("newest")}
            value={filters.sort}
            onChange={(e) => changeFilter("sort", e.target.value)}
          >
            <option value="desc">{t("newest")}</option>
            <option value="asc">{t("oldest")}</option>
          </select>
        </div>
        <div className="share-load-status" role="status">
          {loading ? (
            t("loading")
          ) : error ? (
            <>
              <span>{t("loadFailed")}</span>
              <button onClick={paging.reload}>{t("retry")}</button>
            </>
          ) : null}
        </div>
        <div className="share-results" aria-busy={loading} data-busy={dataBusy}>
          {total === 0 ? (
            <div className="share-empty">
              <ImageOff />
              <h2>{hasFilters ? t("noMatch") : labels.noPhotos}</h2>
              <p>{hasFilters ? t("noMatchHint") : labels.noPhotosHint}</p>
              {hasFilters && (
                <button
                  onClick={() => {
                    setFilters(defaultFilters);
                    setSelected(new Set());
                  }}
                >
                  {t("clear")}
                </button>
              )}
            </div>
          ) : view === "map" ? (
            <>
              <p className="share-map-page-note">{t("mapPage")}</p>
              <PhotoMap photos={photos} onOpen={openPhoto} t={t} />
            </>
          ) : view === "table" ? (
            <div className="share-table-wrap">
              <table className="share-table">
                <thead>
                  <tr>
                    <th>{t("select")}</th>
                    {(
                      [
                        "photo",
                        "filename",
                        "project",
                        "member",
                        "time",
                        "location",
                        "type",
                      ] as const
                    ).map((key) => (
                      <th key={key}>{t(key)}</th>
                    ))}
                    <th>{labels.download}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
                    <tr
                      key={p.photoID}
                      className={selected.has(p.photoID) ? "is-selected" : ""}
                    >
                      <td>
                        <Checkbox
                          checked={selected.has(p.photoID)}
                          label={`${t("select")} ${p.localPhotoName || p.photoID}`}
                          onChange={(v) => choose([p.photoID], v)}
                        />
                      </td>
                      <td>
                        <button
                          className="share-table-thumb"
                          onClick={() => openPhoto(p.photoID)}
                          aria-label={`${labels.viewLarge} ${p.localPhotoName || p.photoID}`}
                        >
                          <Thumb photo={p} label={t("photoFailed")} />
                        </button>
                      </td>
                      <td>
                        <button
                          className="share-filename"
                          onClick={() => openPhoto(p.photoID)}
                        >
                          {p.localPhotoName || p.photoID}
                        </button>
                      </td>
                      <td>{p.projectName || "—"}</td>
                      <td>{p.userName || "—"}</td>
                      <td className="share-nowrap">
                        {p.timeText}
                        <small>{p.timeZone}</small>
                      </td>
                      <td>
                        <span
                          className="share-location"
                          title={p.location || ""}
                        >
                          {p.location || "—"}
                        </span>
                      </td>
                      <td>{t(p.mediaType === 1 ? "video" : "photo")}</td>
                      <td>
                        <button
                          aria-label={labels.download}
                          onClick={() =>
                            singleDownload({ ...p, photoCode: null })
                          }
                        >
                          <Download size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="share-days">
              {groups.map(([date, items]) => (
                <section key={date}>
                  <div className="share-day-heading">
                    <Checkbox
                      checked={dayPhotos(date).every((p) =>
                        selected.has(p.photoID),
                      )}
                      mixed={
                        dayPhotos(date).some((p) => selected.has(p.photoID)) &&
                        !dayPhotos(date).every((p) => selected.has(p.photoID))
                      }
                      label={`${t("select")} ${date}`}
                      onChange={(v) => chooseDay(date, v)}
                    />
                    <h2>{date}</h2>
                    <span>
                      {t("pageOnly")} {dayPhotos(date).length}
                    </span>
                    <button
                      title={t("download")}
                      aria-label={`${t("download")} ${date}`}
                      onClick={() => chooseDay(date, true, true)}
                    >
                      <Download size={15} />
                    </button>
                  </div>
                  <div className="share-grid">
                    {items.map((p) => (
                      <article
                        key={p.photoID}
                        className={`share-photo ${selected.has(p.photoID) ? "is-selected" : ""}`}
                      >
                        <button
                          className="share-open-photo"
                          onClick={() => openPhoto(p.photoID)}
                          aria-label={`${labels.viewLarge} ${p.localPhotoName || p.photoID}`}
                        >
                          <Thumb photo={p} label={t("photoFailed")} />
                          {p.mediaType === 1 && (
                            <span className="share-video">
                              <Play size={13} />
                              {p.duration != null
                                ? `${Math.floor(p.duration / 60)}:${String(p.duration % 60).padStart(2, "0")}`
                                : t("video")}
                            </span>
                          )}
                        </button>
                        <div className="share-photo-check">
                          <Checkbox
                            checked={selected.has(p.photoID)}
                            label={`${t("select")} ${p.localPhotoName || p.photoID}`}
                            onChange={(v) => choose([p.photoID], v)}
                          />
                        </div>
                        <div className="share-caption">
                          <span>{p.userName || "—"}</span>
                          <time>{p.timeText.split(" ").pop()}</time>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          {total > 0 && (
            <nav className="share-pagination" aria-label={t("next")}>
              <span>
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, total)} / {total}
              </span>
              <div>
                <button
                  disabled={dataBusy || currentPage === 1}
                  aria-label={t("previous")}
                  onClick={() => {
                    setPage(currentPage - 1);
                    document
                      .querySelector(".share-toolbar")
                      ?.scrollIntoView({ block: "start" });
                  }}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {currentPage} / {pages}
                </span>
                <button
                  disabled={dataBusy || currentPage >= pages}
                  aria-label={t("next")}
                  onClick={() => {
                    setPage(currentPage + 1);
                    document
                      .querySelector(".share-toolbar")
                      ?.scrollIntoView({ block: "start" });
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </nav>
          )}
        </div>
        <footer className="share-footer">
          <Camera size={16} />
          <span>Timeprint</span>
          <span>·</span>
          <span>{t("shared")}</span>
        </footer>
      </div>
      {selected.size > 0 && !active && !exportFormat && (
        <div className="share-selection">
          <span>
            {t("selected")} <strong>{selected.size}</strong>
          </span>
          <button onClick={() => openExport("zip")}>
            <Download size={16} />
            {labels.download}
          </button>
          <button
            aria-label={t("deselect")}
            onClick={() => setSelected(new Set())}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {notice && (
        <div className="share-toast" role="status">
          {notice}
          <button aria-label={t("close")} onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {active && (
        <SharedPhotoPreview
          photo={{ ...active, photoCode: null }}
          photos={previewPhotos}
          onChoose={openPhoto}
          onClose={closePhoto}
          download={singleDownload}
          t={wt}
          locale={currentLocale}
          tz="UTC"
          captureTimeText={active.timeText}
        />
      )}
      {exportFormat && (
        <WorkspaceDialog
          className="share-export-dialog"
          label={t("export")}
          onClose={closeExport}
        >
          <header>
            <h2>
              {t(
                exportFormat === "zip"
                  ? "exportTitle"
                  : exportFormat === "xlsx"
                    ? "excel"
                    : "pdf",
              )}
            </h2>
            <button aria-label={t("close")} onClick={closeExport}>
              <X />
            </button>
          </header>
          <div className="share-export-body">
            <p>
              {t(
                exportFormat === "print"
                  ? "printHint"
                  : exportFormat === "xlsx"
                    ? "excelHint"
                    : "exportHint",
              )}
            </p>
            <label>
              {t("exportRange")}
              <select
                disabled={busy}
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="all">
                  {t("allResults")} ({total})
                </option>
                <option value="page">
                  {t("pageOnly")} ({visible.length})
                </option>
                <option value="selected" disabled={!selected.size}>
                  {t("selectedOnly")} ({selected.size})
                </option>
              </select>
            </label>
            <div className="share-export-count">
              <strong>{exportCount}</strong>
              <span>{t("count")}</span>
            </div>
            {exportFormat === "xlsx" && (
              <p>{t("excelImagesHint")}</p>
            )}
            {exportCount > maxExport && (
              <p className="share-error">
                {t("exportRange")}: {maxExport} {t("count")}
              </p>
            )}
          </div>
          <footer>
            <button onClick={closeExport}>{t("cancel")}</button>
            <button
              className="share-primary"
              disabled={
                busy || zipBusy || dataBusy || !exportCount || exportCount > maxExport
              }
              onClick={startExport}
            >
              {busy ? (
                <>
                  <LoaderCircle size={17} className="share-spin" />
                  {t("busy")}
                </>
              ) : (
                t(exportFormat === "print" ? "print" : "start")
              )}
            </button>
          </footer>
        </WorkspaceDialog>
      )}
      <div className="share-print" ref={printRoot}>
        <h1>{header.title}</h1>
        <p>
          Timeprint · {printPhotos.length} {t("count")}
        </p>
        {printPhotos.map((p) => (
          <article key={p.photoID}>
            {p.thumbnailURL && (
              <img
                src={
                  p.mediaType === 1
                    ? p.thumbnailURL
                    : p.imageURL || p.thumbnailURL
                }
                alt={p.localPhotoName || ""}
              />
            )}
            <div>
              <strong>{p.timeText}</strong>
              <p>
                {p.userName} · {p.projectName}
              </p>
              <p>{p.location}</p>
              <small>{p.localPhotoName}</small>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
function MapGroup(photos: WebPhoto[]) {
  const groups = new Map<string, WebPhoto[]>();
  for (const p of photos)
    groups.set(p.dateText, [...(groups.get(p.dateText) || []), p]);
  return groups;
}
