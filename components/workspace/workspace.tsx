"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Images,
  FolderOpen,
  Users,
  Archive,
  Settings,
  LogOut,
  Search,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  List,
  Check,
  X,
  SlidersHorizontal,
  Download,
  Plus,
  MapPin,
  ArrowUpRight,
  CheckSquare,
  Clock3,
  LoaderCircle,
  CircleAlert,
  RefreshCw,
  Pencil,
  Menu,
} from "lucide-react";
import { Dashboard } from "@/components/dashboard";
import { clientLocale, setClientLocale, type AppLocale } from "@/lib/i18n";
import { authenticatedFetch } from "@/lib/client-auth";
import {
  dateKey,
  emptySelection,
  isSelected,
  selectionCount,
  toggleIDs,
  type PhotoFilters,
  type Selection,
  type WorkspaceData,
  type WorkspacePhoto,
  type WorkspaceProject,
  type ExportJob,
} from "@/lib/workspace/model";
import { workspaceCopy, errorCopy, type CopyKey } from "@/lib/workspace/i18n";
import { WorkspaceDialog } from "./dialog";
import { PhotoPreview } from "./photo-preview";
import "./workspace.css";

type Props = {
  token: string;
  user: {
    id: string;
    email: string;
    userName?: string | null;
    shortName?: string | null;
  };
  expiresAt: string;
  onLogout: () => void;
};
type PhotoPage = {
  photos: WorkspacePhoto[];
  focused: WorkspacePhoto | null;
  total: number;
  pages: number;
  page: number;
  pageSize: number;
};
const defaultZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
function validZone(value: string | null) {
  try {
    if (value) {
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
      return value;
    }
  } catch {}
  return defaultZone();
}
function localURL() {
  return typeof window === "undefined"
    ? "/"
    : window.location.pathname + window.location.search;
}
function useWorkspaceURL() {
  const [url, setURL] = useState("/");
  useEffect(() => {
    setURL(localURL());
    const changed = () => setURL(localURL());
    window.addEventListener("popstate", changed);
    return () => window.removeEventListener("popstate", changed);
  }, []);
  const navigate = useCallback((value: string, replace = false) => {
    window.history[replace ? "replaceState" : "pushState"]({}, "", value);
    setURL(localURL());
  }, []);
  return [url, navigate] as const;
}
function Thumbnail({ src, alt = "" }: { src: string | null; alt?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <div className="ws-thumbnail-empty">
      <Camera size={28} />
    </div>
  );
}
async function saveResponse(
  request: () => Promise<Response>,
  filename: string,
) {
  // Chromium can stream straight to disk, including multi-GB archives.
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (o: {
        suggestedName: string;
      }) => Promise<{ createWritable: () => Promise<WritableStream> }>;
    }
  ).showSaveFilePicker;
  let handle;
  if (picker) {
    try {
      handle = await picker.call(window, { suggestedName: filename });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return false;
      throw e;
    }
  }
  const response = await request();
  if (!response.ok)
    throw new Error((await response.json()).error || "FILE_UNAVAILABLE");
  if (handle && response.body) {
    const output = await handle.createWritable();
    await response.body.pipeTo(output);
  } else {
    const url = URL.createObjectURL(await response.blob()),
      link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return true;
}

export function Workspace(props: Props) {
  const { token, user, onLogout } = props;
  const [url, navigate] = useWorkspaceURL(),
    [locale, setLocale] = useState<AppLocale>("zh-Hans");
  const t = useMemo(() => workspaceCopy(locale), [locale]),
    dateLocale =
      locale === "zh-Hans" ? "zh-CN" : locale === "zh-Hant" ? "zh-TW" : "en";
  const parsed = useMemo(() => new URL(url, "http://workspace.local"), [url]),
    segments = parsed.pathname.split("/").filter(Boolean),
    isGlobalPage =
      segments.length === 2 &&
      ["settings", "administration"].includes(segments[1]),
    groupID =
      segments[0] === "workspace" && !isGlobalPage
        ? decodeURIComponent(segments[1] || "")
        : "",
    section = isGlobalPage ? segments[1] : segments[2] || "photos",
    detailID = segments[3] ? decodeURIComponent(segments[3]) : "";
  useEffect(() => {
    if (section === "verify")
      navigate(`/workspace/${encodeURIComponent(groupID)}/photos`, true);
  }, [section, groupID, navigate]);
  const params = parsed.searchParams,
    paramString = params.toString(),
    previewID = params.get("photo") || "",
    page = Math.max(1, Number(params.get("page") || "1"));
  const filters = useMemo<PhotoFilters>(
    () => ({
      q: params.get("q") || "",
      projectID:
        section === "projects" && detailID
          ? detailID
          : params.get("projectID") || "",
      userID:
        section === "members" && detailID
          ? detailID
          : params.get("userID") || "",
      from: params.get("from") || "",
      to: params.get("to") || "",
      type: params.get("type") || "",
      tz: validZone(params.get("tz")),
    }),
    [paramString, section, detailID],
  );
  const filterKey = JSON.stringify(filters),
    isGallery =
      section === "photos" ||
      (["projects", "members"].includes(section) && !!detailID),
    view = params.get("view") === "table" ? "table" : "grid";
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null),
    [bootstrapBusy, setBootstrapBusy] = useState(true),
    [bootstrapError, setBootstrapError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [photoPage, setPhotoPage] = useState<PhotoPage | null>(null),
    [photoBusy, setPhotoBusy] = useState(false),
    [photoError, setPhotoError] = useState("");
  const [query, setQuery] = useState(filters.q),
    [cardQuery, setCardQuery] = useState(""),
    [sort, setSort] = useState("latest"),
    [selecting, setSelecting] = useState(false),
    [selection, setSelection] = useState<Selection>(emptySelection);
  const [exportDialog, setExportDialog] = useState(false),
    [exportSelection, setExportSelection] = useState<Selection>(emptySelection),
    [exportTitle, setExportTitle] = useState(""),
    [groupBy, setGroupBy] = useState("date"),
    [exportBusy, setExportBusy] = useState(false),
    [exportError, setExportError] = useState("");
  const [jobs, setJobs] = useState<ExportJob[]>([]),
    [jobsBusy, setJobsBusy] = useState(false),
    [jobsError, setJobsError] = useState(""),
    [actionBusy, setActionBusy] = useState("");
  const [projectDialog, setProjectDialog] = useState<
      WorkspaceProject | "new" | null
    >(null),
    [projectName, setProjectName] = useState(""),
    [projectAddress, setProjectAddress] = useState(""),
    [projectBusy, setProjectBusy] = useState(false),
    [projectError, setProjectError] = useState("");
  const [toast, setToast] = useState(""),
    [sidebarOpen, setSidebarOpen] = useState(false),
    contentRef = useRef<HTMLDivElement>(null);
  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await authenticatedFetch(path, token, init);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "SERVER_ERROR");
      return data;
    },
    [token],
  );
  const notify = (message: string) => {
    setToast(message);
  };
  useEffect(() => {
    setLocale(clientLocale());
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const controller = new AbortController();
    setBootstrapBusy(true);
    setBootstrapError("");
    setWorkspace(null);
    const remembered = !groupID
      ? localStorage.getItem("timeprint-workspace")
      : null;
    api(
      `/api/workspace${groupID || remembered ? `?groupID=${encodeURIComponent(groupID || remembered || "")}` : ""}`,
      { signal: controller.signal },
    )
      .catch(async (e) => {
        if (!groupID && remembered && e.message === "FORBIDDEN") {
          localStorage.removeItem("timeprint-workspace");
          return api("/api/workspace", { signal: controller.signal });
        }
        throw e;
      })
      .then((data: WorkspaceData) => {
        if (controller.signal.aborted) return;
        setWorkspace(data);
        if (data.current) {
          localStorage.setItem("timeprint-workspace", data.current.groupID);
          if (!groupID && !isGlobalPage)
            navigate(
              `/workspace/${encodeURIComponent(data.current.groupID)}/photos?tz=${encodeURIComponent(defaultZone())}`,
              true,
            );
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setWorkspace(null);
          setBootstrapError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBootstrapBusy(false);
      });
    return () => controller.abort();
  }, [groupID, refresh, api, navigate]);
  const updateParams = (
    values: Record<string, string | null>,
    replace = false,
  ) => {
    const next = new URLSearchParams(paramString);
    if (!next.has("tz")) next.set("tz", filters.tz);
    for (const [key, value] of Object.entries(values))
      value ? next.set(key, value) : next.delete(key);
    navigate(`${parsed.pathname}${next.size ? `?${next}` : ""}`, replace);
  };
  const go = (target: string) => {
    setSidebarOpen(false);
    setCardQuery("");
    navigate(
      groupID || workspace?.current?.groupID
        ? `/workspace/${encodeURIComponent(groupID || workspace?.current?.groupID || "")}/${target}?tz=${encodeURIComponent(filters.tz)}`
        : `/workspace/${target}`,
    );
    contentRef.current?.scrollTo(0, 0);
  };
  useEffect(() => {
    setQuery(filters.q);
  }, [filters.q]);
  useEffect(() => {
    if (!isGallery || query === filters.q) return;
    const timer = setTimeout(
      () => updateParams({ q: query.trim(), page: null, photo: null }, true),
      350,
    );
    return () => clearTimeout(timer);
  }, [query, filters.q, isGallery, paramString]);
  useEffect(() => {
    setSelection(emptySelection());
    setSelecting(false);
  }, [groupID, filterKey, section, detailID]);
  const galleryQuery = new URLSearchParams({
    ...filters,
    groupID,
    page: String(page),
  }).toString();
  useEffect(() => {
    if (!groupID || !isGallery) return;
    const controller = new AbortController();
    setPhotoBusy(true);
    setPhotoError("");
    api(
      `/api/workspace/photos?${galleryQuery}${previewID ? `&photo=${encodeURIComponent(previewID)}` : ""}`,
      { signal: controller.signal },
    )
      .then((data: PhotoPage) => {
        if (!controller.signal.aborted) setPhotoPage(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setPhotoPage(null);
          setPhotoError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPhotoBusy(false);
      });
    return () => controller.abort();
  }, [galleryQuery, isGallery, refresh, api]);
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [page, filterKey, section, detailID]);
  const loadJobs = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await api(
          `/api/workspace/exports?groupID=${encodeURIComponent(groupID)}`,
          { signal },
        );
        if (!signal?.aborted) {
          setJobs(data.jobs);
          setJobsError("");
        }
      } catch (e) {
        if (!signal?.aborted)
          setJobsError(e instanceof Error ? e.message : "SERVER_ERROR");
      }
    },
    [api, groupID],
  );
  useEffect(() => {
    if (section !== "exports" || !groupID) return;
    const controller = new AbortController();
    setJobs([]);
    setJobsBusy(true);
    loadJobs(controller.signal).finally(() => {
      if (!controller.signal.aborted) setJobsBusy(false);
    });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void loadJobs(controller.signal);
    }, 3000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [section, loadJobs]);
  const selectedProject = workspace?.projects.find(
      (p) => String(p.projectID) === detailID,
    ),
    selectedMember = workspace?.members.find((m) => m.userID === detailID);
  const title =
    section === "projects" && detailID
      ? selectedProject?.projectName || t("project")
      : section === "members" && detailID
        ? selectedMember?.name || t("member")
        : t(
            (
              {
                photos: "allPhotos",
                projects: "projects",
                members: "members",
                exports: "exports",
                settings: "settings",
                administration: "administration",
              } as Record<string, CopyKey>
            )[section] || "allPhotos",
          );
  const filtered = !!(
    filters.q ||
    filters.from ||
    filters.to ||
    filters.type ||
    (filters.projectID && !detailID) ||
    (filters.userID && !detailID)
  );
  const photos = photoPage?.photos || [],
    total = photoPage?.total || 0,
    selectedCount = selectionCount(selection, total);
  const preview =
    photos.find((p) => p.photoID === previewID) ||
    (photoPage?.focused?.photoID === previewID ? photoPage.focused : null);
  const days = useMemo(() => {
    const result: Record<string, WorkspacePhoto[]> = {};
    for (const p of photos) {
      const day = dateKey(p.timestamp, filters.tz);
      (result[day] ||= []).push(p);
    }
    return Object.entries(result);
  }, [photos, filters.tz]);
  const formatDate = (timestamp: number) =>
    new Intl.DateTimeFormat(dateLocale, {
      timeZone: filters.tz,
      dateStyle: "medium",
    }).format(timestamp);
  const formatTime = (timestamp: number) =>
    new Intl.DateTimeFormat(dateLocale, {
      timeZone: filters.tz,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(timestamp);
  const setFilter = (key: string, value: string) =>
    updateParams({
      [key]: value,
      page: null,
      photo: null,
      ...(["from", "to"].includes(key) ? { range: null } : {}),
    });
  const clearFilters = () => {
    setQuery("");
    updateParams({
      q: null,
      from: null,
      to: null,
      type: null,
      projectID: null,
      userID: null,
      page: null,
      photo: null,
    });
  };
  const datePreset =
    filters.from || filters.to
      ? ["today", "week", "month"].includes(params.get("range") || "")
        ? params.get("range")!
        : "custom"
      : "all";
  const setDateRange = (preset: string) => {
    const today = dateKey(Date.now(), filters.tz),
      [y, m, d] = today.split("-").map(Number),
      date = new Date(Date.UTC(y, m - 1, d));
    let from = today;
    if (preset === "week") {
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      from = date.toISOString().slice(0, 10);
    }
    if (preset === "month") from = `${today.slice(0, 7)}-01`;
    updateParams({
      range: preset === "all" ? null : preset,
      from: preset === "all" ? null : from,
      to: preset === "all" ? null : today,
      page: null,
      photo: null,
    });
  };
  const download = async (photo: WorkspacePhoto) => {
    try {
      await saveResponse(
        () =>
          authenticatedFetch(
            `/api/workspace/photos/download?groupID=${encodeURIComponent(groupID)}&photoID=${encodeURIComponent(photo.photoID)}`,
            token,
          ),
        photo.localPhotoName ||
          `${photo.photoID}.${photo.mediaType === 1 ? "mp4" : "jpg"}`,
      );
    } catch (e) {
      notify(errorCopy(t, e instanceof Error ? e.message : "FILE_UNAVAILABLE"));
    }
  };
  const openExport = () => {
    setExportSelection(
      selecting ? selection : { mode: "all", ids: [], excluded: [] },
    );
    setExportTitle(title);
    setExportError("");
    setExportDialog(true);
  };
  const createExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setExportBusy(true);
    setExportError("");
    try {
      if (!workspace?.backgroundExports) {
        const count = selectionCount(exportSelection, total);
        if (!count || count > 200) throw new Error(count ? "DIRECT_EXPORT_LIMIT" : "NO_PHOTOS");
        const saved = await saveResponse(
          () => authenticatedFetch("/api/workspace/photos/export", token, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groupID, filters, selection: exportSelection, title: exportTitle, groupBy, expectedCount: count }),
          }),
          `${exportTitle.replace(/[\\/:*?"<>|]/g, "_")}.zip`,
        );
        if (saved) {
          setExportDialog(false);
          notify(t("exportDownloaded"));
        }
        return;
      }
      await api("/api/workspace/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupID,
          filters,
          selection: exportSelection,
          title: exportTitle,
          groupBy,
          expectedCount: selectionCount(exportSelection, total),
        }),
      });
      setExportDialog(false);
      setSelecting(false);
      setSelection(emptySelection());
      notify(t("exportQueued"));
      go("exports");
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "SERVER_ERROR");
    } finally {
      setExportBusy(false);
    }
  };
  const jobAction = async (job: ExportJob, action: string) => {
    setActionBusy(job.id);
    try {
      if (action === "download")
        await saveResponse(
          () =>
            authenticatedFetch(
              `/api/workspace/exports/${job.id}/download`,
              token,
            ),
          `${job.title}.zip`,
        );
      else {
        await api(`/api/workspace/exports/${job.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        await loadJobs();
      }
    } catch (e) {
      notify(errorCopy(t, e instanceof Error ? e.message : "SERVER_ERROR"));
    } finally {
      setActionBusy("");
    }
  };
  const editProject = (project?: WorkspaceProject) => {
    setProjectDialog(project || "new");
    setProjectName(project?.projectName || "");
    setProjectAddress(project?.address || "");
    setProjectError("");
  };
  const saveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setProjectBusy(true);
    setProjectError("");
    try {
      const data = await api("/api/workspace/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupID,
          projectID:
            projectDialog && projectDialog !== "new"
              ? projectDialog.projectID
              : undefined,
          projectName,
          address: projectAddress,
        }),
      });
      setProjectDialog(null);
      setRefresh((n) => n + 1);
      notify(t("projectSaved"));
      go(`projects/${data.projectID}`);
    } catch (e) {
      setProjectError(e instanceof Error ? e.message : "SERVER_ERROR");
    } finally {
      setProjectBusy(false);
    }
  };
  const previewOpened = useRef(false);
  const navigatePhoto = (id: string) => {
    if (!previewID) previewOpened.current = true;
    updateParams({ photo: id }, !!previewID);
  };
  const closePreview = () => {
    if (previewOpened.current) {
      previewOpened.current = false;
      window.history.back();
    } else updateParams({ photo: null }, true);
  };
  const iconButton = (
    label: string,
    icon: React.ReactNode,
    fn: () => void,
    active = false,
  ) => (
    <button
      className={`ws-icon-button ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={fn}
    >
      {icon}
    </button>
  );
  const empty = (heading: string, description?: string) => (
    <div className="ws-empty">
      <div>
        <Images size={32} />
      </div>
      <h2>{heading}</h2>
      {description && <p>{description}</p>}
      {filtered && (
        <button className="ws-button" onClick={clearFilters}>
          {t("clear")}
        </button>
      )}
    </div>
  );
  const errorPanel = (error: string) => (
    <div role="alert" className="ws-error">
      <CircleAlert size={19} />
      <p>{errorCopy(t, error)}</p>
      <button className="ws-button" onClick={() => setRefresh((n) => n + 1)}>
        <RefreshCw size={15} />
        {t("retry")}
      </button>
    </div>
  );
  const navItems = [
    {
      key: "photos",
      label: "allPhotos" as const,
      icon: Images,
      count: workspace?.photoCount,
    },
    {
      key: "projects",
      label: "projects" as const,
      icon: FolderOpen,
      count: workspace?.projects.length,
    },
    {
      key: "members",
      label: "members" as const,
      icon: Users,
      count: workspace?.members.length,
    },
  ];

  if (["settings", "administration"].includes(section))
    return (
      <div className="ws-legacy">
        <button className="ws-button ws-back" onClick={() => go("photos")}>
          <ChevronLeft size={17} />
          {t("back")}
        </button>
        <Dashboard {...props} />
      </div>
    );
  return (
    <div className="ws-app" lang={dateLocale}>
      {sidebarOpen && (
        <button
          className="ws-sidebar-scrim"
          aria-label={t("close")}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`ws-sidebar ${sidebarOpen ? "open" : ""}`}>
        <a
          className="ws-brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("photos");
          }}
        >
          <img src="/logo.png" alt="" />
          <span>
            Timeprint<small>TEAMSPACE</small>
          </span>
        </a>
        <div className="ws-workspace-picker">
          <label htmlFor="workspace-picker">{t("workspace")}</label>
          <select
            id="workspace-picker"
            value={groupID}
            onChange={(e) => {
              navigate(
                `/workspace/${encodeURIComponent(e.target.value)}/photos?tz=${encodeURIComponent(filters.tz)}`,
              );
              setSidebarOpen(false);
            }}
          >
            {!workspace?.teams.length && (
              <option value="">{t("noTeam")}</option>
            )}
            {workspace?.teams.map((team) => (
              <option value={team.groupID} key={team.groupID}>
                {team.groupName}
              </option>
            ))}
          </select>
        </div>
        <nav aria-label={t("library")}>
          <p className="ws-nav-label">{t("library")}</p>
          {navItems.map((item) => (
            <a
              key={item.key}
              className={`ws-nav-item ${section === item.key ? "active" : ""}`}
              aria-current={section === item.key ? "page" : undefined}
              href={`/workspace/${groupID}/${item.key}`}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) return;
                e.preventDefault();
                go(item.key);
              }}
            >
              <item.icon size={19} />
              <span>{t(item.label)}</span>
              <small>{item.count ?? "—"}</small>
            </a>
          ))}
          <a
            className={`ws-nav-item ${section === "exports" ? "active" : ""}`}
            href={`/workspace/${groupID}/exports`}
            onClick={(e) => {
              e.preventDefault();
              go("exports");
            }}
          >
            <Archive size={19} />
            <span>{t("exports")}</span>
          </a>
          <p className="ws-nav-label ws-tools-label">{t("tools")}</p>
          <button className="ws-nav-item" onClick={() => go("settings")}>
            <Settings size={19} />
            <span>{t("settings")}</span>
          </button>
          {workspace?.isSuperAdmin && (
            <button
              className="ws-nav-item"
              onClick={() => go("administration")}
            >
              <SlidersHorizontal size={19} />
              <span>{t("administration")}</span>
            </button>
          )}
        </nav>
        <div className="ws-sidebar-bottom">
          <div className="ws-user-avatar">
            {(user.userName || user.email || "T").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>
              {user.userName || user.shortName || user.email.split("@")[0]}
            </strong>
            <span>{user.email}</span>
          </div>
          <button
            aria-label={t("logout")}
            title={t("logout")}
            onClick={onLogout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="ws-main">
        <header className="ws-topbar">
          <div>
            <button
              className="ws-mobile-menu ws-icon-button"
              aria-label={t("workspace")}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span>{workspace?.current?.groupName || "Timeprint"}</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div>
            <span className="ws-topbar-product">TeamSpace</span>
            <select
              aria-label="Language"
              className="ws-language"
              value={
                locale === "zh-Hans" || locale === "zh-Hant" ? locale : "en"
              }
              onChange={(e) => setLocale(setClientLocale(e.target.value))}
            >
              <option value="zh-Hans">简体中文</option>
              <option value="zh-Hant">繁體中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </header>
        <div className="ws-content" ref={contentRef}>
          <div className="ws-page-header">
            <div>
              <div className="ws-eyebrow">
                {section === "exports"
                  ? t("exports")
                  : detailID
                    ? t(section === "projects" ? "project" : "author")
                    : t("library")}
              </div>
              <h1>
                {title}
                {isGallery && !photoBusy && (
                  <span className="ws-count-badge">
                    {total.toLocaleString()}
                  </span>
                )}
              </h1>
              <p>
                {detailID
                  ? selectedProject?.address ||
                    (selectedMember ? t("membersDesc") : "")
                  : t(
                      section === "projects"
                        ? "projectsDesc"
                        : section === "members"
                          ? "membersDesc"
                          : section === "exports"
                            ? workspace?.backgroundExports ? "exportDesc" : "directExportHistory"
                            : "allDesc",
                    )}
                {workspace && !workspace.canManage && isGallery && (
                  <span className="ws-own-scope">{t("ownOnly")}</span>
                )}
              </p>
            </div>
            <div className="ws-header-actions">
              {selectedProject && workspace?.canManage && (
                <button
                  className="ws-button"
                  onClick={() => editProject(selectedProject)}
                >
                  <Pencil size={16} />
                  {t("editProject")}
                </button>
              )}
              {section === "projects" && !detailID && workspace?.canManage && (
                <button
                  className="ws-button ws-primary"
                  onClick={() => editProject()}
                >
                  <Plus size={17} />
                  {t("newProject")}
                </button>
              )}
              {isGallery && (
                <button
                  className="ws-button ws-primary"
                  disabled={
                    bootstrapBusy ||
                    photoBusy ||
                    query.trim() !== filters.q ||
                    !total ||
                    (selecting && !selectedCount)
                  }
                  onClick={openExport}
                >
                  <Download size={17} />
                  {t("export")}
                </button>
              )}
            </div>
          </div>
          {bootstrapError ? (
            errorPanel(bootstrapError)
          ) : bootstrapBusy && !workspace ? (
            <div className="ws-loading">
              <LoaderCircle className="ws-spin" />
              {t("loading")}
            </div>
          ) : !workspace?.current ? (
            empty(t("noTeam"), t("noTeamDesc"))
          ) : (
            <>
              {isGallery && (
                <>
                  <div className="ws-filter-panel">
                    <div className="ws-search">
                      <Search size={18} />
                      <input
                        aria-label={t("search")}
                        placeholder={t("search")}
                        value={query}
                        maxLength={200}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button
                          aria-label={t("clear")}
                          onClick={() => setQuery("")}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                    <div className="ws-filter-row">
                      {!(section === "projects" && detailID) && (
                        <select
                          aria-label={t("allProjects")}
                          value={filters.projectID}
                          onChange={(e) =>
                            setFilter("projectID", e.target.value)
                          }
                        >
                          <option value="">{t("allProjects")}</option>
                          {workspace.projects.map((p) => (
                            <option key={p.projectID} value={p.projectID}>
                              {p.projectName}
                            </option>
                          ))}
                        </select>
                      )}
                      {!(section === "members" && detailID) && (
                        <select
                          aria-label={t("allMembers")}
                          value={filters.userID}
                          onChange={(e) => setFilter("userID", e.target.value)}
                        >
                          <option value="">{t("allMembers")}</option>
                          {workspace.members.map((m) => (
                            <option key={m.userID} value={m.userID}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        aria-label={t("allTypes")}
                        value={filters.type}
                        onChange={(e) => setFilter("type", e.target.value)}
                      >
                        <option value="">{t("allTypes")}</option>
                        <option value="0">{t("photo")}</option>
                        <option value="1">{t("video")}</option>
                      </select>
                      <select
                        aria-label={t("allDates")}
                        value={datePreset}
                        onChange={(e) => setDateRange(e.target.value)}
                      >
                        <option value="all">{t("allDates")}</option>
                        <option value="today">{t("today")}</option>
                        <option value="week">{t("week")}</option>
                        <option value="month">{t("month")}</option>
                        <option value="custom" disabled>
                          {t("custom")}
                        </option>
                      </select>
                      <div className="ws-date-inputs">
                        <input
                          type="date"
                          aria-label={t("from")}
                          value={filters.from}
                          max={filters.to || undefined}
                          onChange={(e) => setFilter("from", e.target.value)}
                        />
                        <span>–</span>
                        <input
                          type="date"
                          aria-label={t("to")}
                          value={filters.to}
                          min={filters.from || undefined}
                          onChange={(e) => setFilter("to", e.target.value)}
                        />
                      </div>
                      {filtered && (
                        <button className="ws-link" onClick={clearFilters}>
                          <X size={14} />
                          {t("clear")}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="ws-gallery-toolbar">
                    <div>
                      <button
                        className={`ws-button ${selecting ? "ws-selected-button" : ""}`}
                        onClick={() => {
                          setSelecting(!selecting);
                          setSelection(emptySelection());
                        }}
                      >
                        <CheckSquare size={16} />
                        {t(selecting ? "done" : "select")}
                      </button>
                      <span className="ws-result-count">
                        {total.toLocaleString()} {t("photos")}
                      </span>
                    </div>
                    <div>
                      <span className="ws-timezone" title={t("timezone")}>
                        {filters.tz}
                      </span>
                      <div className="ws-view-toggle">
                        {iconButton(
                          t("grid"),
                          <LayoutGrid size={17} />,
                          () => updateParams({ view: null }),
                          view === "grid",
                        )}
                        {iconButton(
                          t("table"),
                          <List size={18} />,
                          () => updateParams({ view: "table" }),
                          view === "table",
                        )}
                      </div>
                    </div>
                  </div>
                  {photoError ? (
                    errorPanel(photoError)
                  ) : photoBusy ? (
                    <div
                      className="ws-photo-grid ws-skeletons"
                      aria-label={t("loading")}
                    >
                      {Array.from({ length: 10 }, (_, i) => (
                        <div key={i} />
                      ))}
                    </div>
                  ) : !photos.length ? (
                    empty(t("noPhotos"), t("noPhotosDesc"))
                  ) : (
                    <>
                      {view === "grid" ? (
                        days.map(([day, dayPhotos]) => (
                          <section className="ws-day" key={day}>
                            <div className="ws-day-heading">
                              {selecting && (
                                <input
                                  type="checkbox"
                                  aria-label={`${t("daySelect")} ${day}`}
                                  checked={dayPhotos.every((p) =>
                                    isSelected(selection, p.photoID),
                                  )}
                                  onChange={(e) =>
                                    setSelection((s) =>
                                      toggleIDs(
                                        s,
                                        dayPhotos.map((p) => p.photoID),
                                        e.target.checked,
                                      ),
                                    )
                                  }
                                />
                              )}
                              <h2>{day}</h2>
                              <span>
                                {dayPhotos.length} {t("photos")}
                              </span>
                              <div />
                            </div>
                            <div className="ws-photo-grid">
                              {dayPhotos.map((p) => (
                                <article
                                  className={`ws-photo-card ${selecting && isSelected(selection, p.photoID) ? "selected" : ""}`}
                                  key={p.photoID}
                                >
                                  <button
                                    className="ws-photo-open"
                                    aria-label={`${t("openPhoto")} ${p.localPhotoName || p.photoID}`}
                                    onClick={() =>
                                      selecting
                                        ? setSelection((s) =>
                                            toggleIDs(
                                              s,
                                              [p.photoID],
                                              !isSelected(s, p.photoID),
                                            ),
                                          )
                                        : navigatePhoto(p.photoID)
                                    }
                                  >
                                    <Thumbnail src={p.thumbnailURL} />
                                    {p.mediaType === 1 && (
                                      <span className="ws-video-badge">
                                        ▶{" "}
                                        {p.duration != null
                                          ? `${Math.floor(p.duration / 60)}:${String(p.duration % 60).padStart(2, "0")}`
                                          : t("video")}
                                      </span>
                                    )}
                                  </button>
                                  {selecting && (
                                    <input
                                      className="ws-photo-checkbox"
                                      type="checkbox"
                                      aria-label={`${t("select")} ${p.localPhotoName || p.photoID}`}
                                      checked={isSelected(selection, p.photoID)}
                                      onChange={(e) =>
                                        setSelection((s) =>
                                          toggleIDs(
                                            s,
                                            [p.photoID],
                                            e.target.checked,
                                          ),
                                        )
                                      }
                                    />
                                  )}
                                  <div className="ws-photo-meta">
                                    <div className="ws-photo-caption">
                                      <span title={p.userName || ""}>
                                        {p.userName || "—"}
                                      </span>
                                      <time>{formatTime(p.timestamp)}</time>
                                    </div>
                                    {p.projectName && (
                                      <div className="ws-photo-project">
                                        <FolderOpen size={12} />
                                        <span>{p.projectName}</span>
                                      </div>
                                    )}
                                  </div>
                                </article>
                              ))}
                            </div>
                          </section>
                        ))
                      ) : (
                        <div className="ws-table-wrap">
                          <table className="ws-table">
                            <thead>
                              <tr>
                                {selecting && <th />}
                                <th>{t("photo")}</th>
                                <th>{t("author")}</th>
                                <th>{t("project")}</th>
                                <th>{t("takenAt")}</th>
                                <th>{t("location")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {photos.map((p) => (
                                <tr key={p.photoID}>
                                  {selecting && (
                                    <td>
                                      <input
                                        type="checkbox"
                                        aria-label={`${t("select")} ${p.localPhotoName || p.photoID}`}
                                        checked={isSelected(
                                          selection,
                                          p.photoID,
                                        )}
                                        onChange={(e) =>
                                          setSelection((s) =>
                                            toggleIDs(
                                              s,
                                              [p.photoID],
                                              e.target.checked,
                                            ),
                                          )
                                        }
                                      />
                                    </td>
                                  )}
                                  <td>
                                    <button
                                      className="ws-table-photo"
                                      onClick={() => navigatePhoto(p.photoID)}
                                    >
                                      <Thumbnail src={p.thumbnailURL} />
                                      <span>
                                        {p.localPhotoName || t("photo")}
                                      </span>
                                    </button>
                                  </td>
                                  <td>{p.userName || "—"}</td>
                                  <td>{p.projectName || "—"}</td>
                                  <td>
                                    {formatDate(p.timestamp)}
                                    <small>{formatTime(p.timestamp)}</small>
                                  </td>
                                  <td>{p.location || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="ws-pagination">
                        <span>
                          {total.toLocaleString()} {t("photos")} · {t("page")}{" "}
                          {photoPage?.page} / {photoPage?.pages}
                        </span>
                        <div>
                          <button
                            className="ws-button"
                            disabled={photoPage?.page === 1}
                            onClick={() =>
                              updateParams({
                                page: String((photoPage?.page || 1) - 1),
                                photo: null,
                              })
                            }
                          >
                            <ChevronLeft size={16} />
                            {t("previous")}
                          </button>
                          <button
                            className="ws-button"
                            disabled={photoPage?.page === photoPage?.pages}
                            onClick={() =>
                              updateParams({
                                page: String((photoPage?.page || 1) + 1),
                                photo: null,
                              })
                            }
                          >
                            {t("next")}
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
              {["projects", "members"].includes(section) && !detailID && (
                <>
                  <div className="ws-cards-toolbar">
                    <div className="ws-search">
                      <Search size={18} />
                      <input
                        aria-label={t(
                          section === "projects"
                            ? "searchProjects"
                            : "searchMembers",
                        )}
                        placeholder={t(
                          section === "projects"
                            ? "searchProjects"
                            : "searchMembers",
                        )}
                        value={cardQuery}
                        onChange={(e) => setCardQuery(e.target.value)}
                      />
                    </div>
                    <select
                      aria-label={t("newest")}
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="latest">{t("newest")}</option>
                      <option value="name">{t("name")}</option>
                      <option value="count">{t("count")}</option>
                    </select>
                  </div>
                  {(() => {
                    const cards =
                      section === "projects"
                        ? workspace.projects.map((p) => ({
                            id: String(p.projectID),
                            name: p.projectName,
                            subtitle: p.address || t("noAddress"),
                            count: p.count,
                            latest: p.latest,
                            covers: p.covers,
                            badge: `${p.memberCount} ${t("members")}`,
                            avatar: null as string | null,
                          }))
                        : workspace.members.map((m) => ({
                            id: m.userID,
                            name: m.name,
                            subtitle: t(
                              m.role === "OWNER"
                                ? "owner"
                                : m.role === "ADMIN"
                                  ? "admin"
                                  : "member",
                            ),
                            count: m.count,
                            latest: m.latest,
                            covers: m.covers,
                            badge: "",
                            avatar: m.avatar,
                          }));
                    const result = cards
                      .filter((c) =>
                        `${c.name} ${c.subtitle}`
                          .toLowerCase()
                          .includes(cardQuery.toLowerCase()),
                      )
                      .sort((a, b) =>
                        sort === "name"
                          ? a.name.localeCompare(b.name)
                          : sort === "count"
                            ? b.count - a.count
                            : (b.latest || 0) - (a.latest || 0),
                      );
                    return result.length ? (
                      <div className="ws-project-grid">
                        {result.map((c) => (
                          <a
                            className="ws-project-card"
                            key={c.id}
                            href={`/workspace/${groupID}/${section}/${c.id}`}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey) return;
                              e.preventDefault();
                              go(`${section}/${c.id}`);
                            }}
                          >
                            <div
                              className={`ws-cover-collage covers-${c.covers.length}`}
                            >
                              {c.covers.length ? (
                                c.covers.map((cover, i) => (
                                  <Thumbnail src={cover} key={i} />
                                ))
                              ) : (
                                <div className="ws-cover-empty">
                                  <FolderOpen size={33} />
                                  <span>{t("noCover")}</span>
                                </div>
                              )}
                              <span className="ws-cover-count">
                                <Images size={13} />
                                {c.count.toLocaleString()}
                              </span>
                            </div>
                            <div className="ws-project-info">
                              <div className="ws-project-title">
                                {section === "members" && (
                                  <span className="ws-card-avatar">
                                    {c.avatar ? (
                                      <img src={c.avatar} alt="" />
                                    ) : (
                                      c.name.slice(0, 1)
                                    )}
                                  </span>
                                )}
                                <h2>{c.name}</h2>
                                <ArrowUpRight size={18} />
                              </div>
                              <p>
                                {section === "projects" && <MapPin size={13} />}
                                <span>{c.subtitle}</span>
                              </p>
                              <div className="ws-card-footer">
                                <span>
                                  <Clock3 size={13} />
                                  {c.latest
                                    ? formatDate(c.latest)
                                    : t("noCover")}
                                </span>
                                <span>{c.badge}</span>
                              </div>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      empty(
                        t(section === "projects" ? "noProjects" : "noMembers"),
                      )
                    );
                  })()}
                </>
              )}
              {section === "exports" && (
                <>
                  {jobsError ? (
                    <div role="alert" className="ws-error">
                      {errorCopy(t, jobsError)}
                      <button
                        className="ws-button"
                        onClick={() => void loadJobs()}
                      >
                        {t("retry")}
                      </button>
                    </div>
                  ) : jobsBusy ? (
                    <div className="ws-loading">
                      <LoaderCircle className="ws-spin" />
                      {t("loading")}
                    </div>
                  ) : !jobs.length ? (
                    empty(t("noExports"), t(workspace?.backgroundExports ? "noExportsDesc" : "directExportHistory"))
                  ) : (
                    <div className="ws-export-list">
                      {jobs.map((job) => (
                        <article className="ws-export-card" key={job.id}>
                          <div className="ws-export-icon">
                            <Archive size={24} />
                          </div>
                          <div className="ws-export-info">
                            <div>
                              <h2>{job.title}.zip</h2>
                              <span
                                className={`ws-status status-${job.status.toLowerCase()}`}
                              >
                                {t(
                                  (
                                    {
                                      QUEUED: "queued",
                                      RUNNING: "running",
                                      COMPLETED: "completed",
                                      PARTIAL: "partial",
                                      FAILED: "failed",
                                      CANCELLED: "cancelled",
                                      EXPIRED: "expired",
                                    } as Record<string, CopyKey>
                                  )[job.status] || "queued",
                                )}
                              </span>
                            </div>
                            <p>
                              {job.total} {t("photos")} ·{" "}
                              {formatDate(Date.parse(job.createdAt))} ·{" "}
                              {job.timeZone}
                            </p>
                            {["RUNNING", "QUEUED"].includes(job.status) ? (
                              <div className="ws-progress">
                                <progress
                                  value={job.processed}
                                  max={job.total}
                                />
                                <span>
                                  {job.processed} / {job.total}
                                </span>
                              </div>
                            ) : (
                              <p>
                                {t("successCount")} {job.succeeded} ·{" "}
                                {t("failureCount")} {job.failures?.length || 0}
                                {job.expiresAt &&
                                  job.status !== "EXPIRED" &&
                                  ` · ${t("expires")} ${formatDate(Date.parse(job.expiresAt))}`}
                              </p>
                            )}
                            {job.error && (
                              <p className="ws-inline-error">
                                {errorCopy(t, job.error)}
                              </p>
                            )}
                            {!!job.failures?.length && (
                              <details>
                                <summary>
                                  {t("failureCount")} ({job.failures.length})
                                </summary>
                                <ul>
                                  {job.failures.map((f) => (
                                    <li key={f.photoID}>
                                      <code>{f.photoID}</code> —{" "}
                                      {errorCopy(t, f.reason)}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                          <div className="ws-export-actions">
                            {["COMPLETED", "PARTIAL"].includes(job.status) && (
                              <button
                                className="ws-button ws-primary"
                                disabled={actionBusy === job.id}
                                onClick={() => void jobAction(job, "download")}
                              >
                                <Download size={16} />
                                {t("download")}
                              </button>
                            )}
                            {["QUEUED", "RUNNING"].includes(job.status) ? (
                              <button
                                className="ws-button"
                                disabled={actionBusy === job.id}
                                onClick={() => void jobAction(job, "cancel")}
                              >
                                {t("cancel")}
                              </button>
                            ) : (
                              [
                                "FAILED",
                                "PARTIAL",
                                "CANCELLED",
                                "EXPIRED",
                              ].includes(job.status) && (
                                <button
                                  className="ws-button"
                                  disabled={actionBusy === job.id}
                                  onClick={() => void jobAction(job, "retry")}
                                >
                                  <RefreshCw size={15} />
                                  {t(
                                    job.status === "PARTIAL"
                                      ? "retryFiles"
                                      : "retry",
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
        {selecting && isGallery && (
          <div className="ws-selection-bar">
            <div>
              <span
                className="ws-selection-number"
                role="status"
                aria-label={`${t("selected")} ${selectedCount}`}
              >
                {selectedCount}
              </span>
              <strong>
                {t(selection.mode === "all" ? "allSelected" : "selected")}
              </strong>
            </div>
            <div>
              <button
                disabled={photoBusy}
                onClick={() =>
                  setSelection((s) =>
                    toggleIDs(
                      s,
                      photos.map((p) => p.photoID),
                      true,
                    ),
                  )
                }
              >
                {t("selectPage")}
              </button>
              <button
                disabled={photoBusy}
                onClick={() =>
                  setSelection({ mode: "all", ids: [], excluded: [] })
                }
              >
                {t("selectAll")} ({total})
              </button>
              <button onClick={() => setSelection(emptySelection())}>
                {t("clearSelection")}
              </button>
            </div>
            <button
              className="ws-button ws-primary"
              disabled={
                !selectedCount || photoBusy || query.trim() !== filters.q
              }
              onClick={openExport}
            >
              <Download size={16} />
              {t("exportSelected")}
            </button>
          </div>
        )}
      </div>
      {preview && !photoBusy && (
        <PhotoPreview
          photo={preview}
          photos={photos}
          onChoose={navigatePhoto}
          onClose={closePreview}
          download={download}
          t={t}
          locale={dateLocale}
          tz={filters.tz}
        />
      )}
      {previewID && !preview && !photoBusy && !photoError && (
        <WorkspaceDialog label={t("openPhoto")} onClose={closePreview}>
          <div className="ws-modal-body">
            {errorCopy(t, "FILE_UNAVAILABLE")}
          </div>
          <footer>
            <button className="ws-button" onClick={closePreview}>
              {t("close")}
            </button>
          </footer>
        </WorkspaceDialog>
      )}
      {exportDialog && (
        <WorkspaceDialog
          label={t("export")}
          onClose={() => {
            if (!exportBusy) setExportDialog(false);
          }}
        >
          <form onSubmit={createExport}>
            <header>
              <div className="ws-modal-icon">
                <Archive size={24} />
              </div>
              <h2>{t("export")}</h2>
              <button
                type="button"
                aria-label={t("close")}
                disabled={exportBusy}
                onClick={() => setExportDialog(false)}
              >
                <X size={21} />
              </button>
            </header>
            <div className="ws-modal-body">
              <p className="ws-export-summary">
                {selectionCount(exportSelection, total).toLocaleString()}{" "}
                <span>{t("photos")}</span>
              </p>
              <label>
                {t("exportTitle")}
                <input
                  required
                  maxLength={100}
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                />
              </label>
              <label>
                {t("groupBy")}
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                >
                  <option value="date">{t("byDate")}</option>
                  <option value="project">{t("byProject")}</option>
                  <option value="member">{t("byMember")}</option>
                </select>
              </label>
              <p className="ws-muted">
                {t("timezone")} {filters.tz}
              </p>
              <p className="ws-modal-note">{t(workspace?.backgroundExports ? "exportNote" : "directExportNote")}</p>
              {exportError && (
                <p role="alert" className="ws-inline-error">
                  {errorCopy(t, exportError)}
                </p>
              )}
            </div>
            <footer>
              <button
                type="button"
                className="ws-button"
                disabled={exportBusy}
                onClick={() => setExportDialog(false)}
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="ws-button ws-primary"
                disabled={exportBusy || !exportTitle.trim()}
              >
                {exportBusy ? (
                  <LoaderCircle size={17} className="ws-spin" />
                ) : (
                  <Download size={17} />
                )}{" "}
                {t(exportBusy && !workspace?.backgroundExports ? "downloading" : "startExport")}
              </button>
            </footer>
          </form>
        </WorkspaceDialog>
      )}
      {projectDialog && (
        <WorkspaceDialog
          label={t(projectDialog === "new" ? "newProject" : "editProject")}
          onClose={() => {
            if (!projectBusy) setProjectDialog(null);
          }}
        >
          <form onSubmit={saveProject}>
            <header>
              <h2>
                {t(projectDialog === "new" ? "newProject" : "editProject")}
              </h2>
              <button
                type="button"
                aria-label={t("close")}
                onClick={() => setProjectDialog(null)}
                disabled={projectBusy}
              >
                <X size={21} />
              </button>
            </header>
            <div className="ws-modal-body">
              <label>
                {t("projectName")}
                <input
                  autoFocus
                  required
                  maxLength={100}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </label>
              <label>
                {t("address")}
                <textarea
                  maxLength={191}
                  value={projectAddress}
                  onChange={(e) => setProjectAddress(e.target.value)}
                />
              </label>
              {projectDialog === "new" && (
                <p className="ws-modal-note">{t("projectNote")}</p>
              )}
              {projectError && (
                <p role="alert" className="ws-inline-error">
                  {errorCopy(t, projectError)}
                </p>
              )}
            </div>
            <footer>
              <button
                type="button"
                className="ws-button"
                disabled={projectBusy}
                onClick={() => setProjectDialog(null)}
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="ws-button ws-primary"
                disabled={projectBusy || !projectName.trim()}
              >
                {t(projectBusy ? "saving" : "save")}
              </button>
            </footer>
          </form>
        </WorkspaceDialog>
      )}
      {toast && (
        <div className="ws-toast" role="status">
          <Check size={18} />
          {toast}
          <button onClick={() => setToast("")} aria-label={t("close")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
