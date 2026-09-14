"use client";
import { useEffect, useRef, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  PanelRight,
  Rows3,
  Download,
  MapPin,
  Copy,
  ExternalLink,
  Camera,
  Info,
} from "lucide-react";
import { WorkspaceDialog } from "./dialog";
import type { WorkspacePhoto } from "@/lib/workspace/model";
import type { WorkspaceCopy } from "@/lib/workspace/i18n";
import { isRTLTeamspaceLocale } from "@/lib/teamspace/translations";
import { teamspaceDateOptions } from "@/lib/teamspace/date-format";
export function PhotoPreview({
  photo,
  photos,
  onChoose,
  onClose,
  download,
  t,
  locale,
  tz,
  captureTimeText,
}: {
  photo: WorkspacePhoto;
  photos: WorkspacePhoto[];
  onChoose: (id: string) => void;
  onClose: () => void;
  download: (p: WorkspacePhoto) => Promise<void>;
  t: WorkspaceCopy;
  locale: string;
  tz: string;
  captureTimeText?: string;
}) {
  const [details, setDetails] = useState(true),
    [strip, setStrip] = useState(true),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [failed, setFailed] = useState(false),
    [copied, setCopied] = useState(false),
    [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
      null,
    ),
    stage = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const index = photos.findIndex((p) => p.photoID === photo.photoID);
  const rtl = isRTLTeamspaceLocale(locale);
  const move = (delta: number) => {
    const p = photos[index + delta];
    if (p) onChoose(p.photoID);
  };
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFailed(false);
    setCopied(false);
  }, [photo.photoID]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        /INPUT|TEXTAREA|SELECT|VIDEO/.test((e.target as HTMLElement)?.tagName)
      )
        return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(rtl ? 1 : -1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        move(rtl ? -1 : 1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const setScale = (value: number) => {
    setZoom(Math.min(4, Math.max(1, value)));
    setPan({ x: 0, y: 0 });
  };
  const coordinate =
    photo.lat != null && photo.lng != null
      ? `${photo.lat.toFixed(6)}, ${photo.lng.toFixed(6)}`
      : "";
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const row = (label: string, value: string | null) => (
    <div className="ws-detail-row">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
  return (
    <WorkspaceDialog
      label={t("openPhoto")}
      onClose={onClose}
      className="ws-preview-overlay"
    >
      <header className="ws-preview-top">
        <div>
          <Camera size={19} />
          <strong>{photo.localPhotoName || t("photo")}</strong>
          <span>{index >= 0 ? `${index + 1} / ${photos.length}` : "—"}</span>
        </div>
        <div>
          <button
            title={details ? t("hideDetails") : t("details")}
            aria-label={details ? t("hideDetails") : t("details")}
            aria-pressed={details}
            onClick={() => setDetails(!details)}
          >
            <PanelRight size={20} />
          </button>
          <button title={t("close")} aria-label={t("close")} onClick={onClose}>
            <X size={23} />
          </button>
        </div>
      </header>
      <div className={`ws-preview-body ${details ? "with-details" : ""}`}>
        <div className="ws-viewer">
          <div className="ws-image-stage" ref={stage}>
            <button
              className="ws-prev-photo"
              aria-label={t("previousPhoto")}
              disabled={index <= 0}
              onClick={() => move(-1)}
            >
              <ChevronLeft />
            </button>
            <div
              className={`ws-image-pan ${zoom > 1 ? "zoomed" : ""}`}
              onTouchStart={(e) => {
                if (
                  zoom === 1 &&
                  e.touches.length === 1 &&
                  photo.mediaType !== 1
                )
                  swipe.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                  };
              }}
              onTouchEnd={(e) => {
                const start = swipe.current;
                swipe.current = null;
                if (!start || zoom !== 1) return;
                const dx = e.changedTouches[0].clientX - start.x,
                  dy = e.changedTouches[0].clientY - start.y;
                if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
                  move((dx < 0 ? 1 : -1) * (rtl ? -1 : 1));
              }}
              onDoubleClick={() => setScale(zoom > 1 ? 1 : 2)}
              onPointerDown={(e) => {
                if (zoom <= 1 || photo.mediaType === 1) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  px: pan.x,
                  py: pan.y,
                };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                const w =
                    ((stage.current?.clientWidth || 800) * (zoom - 1)) / 2,
                  h = ((stage.current?.clientHeight || 500) * (zoom - 1)) / 2;
                setPan({
                  x: Math.max(
                    -w,
                    Math.min(w, drag.current.px + e.clientX - drag.current.x),
                  ),
                  y: Math.max(
                    -h,
                    Math.min(h, drag.current.py + e.clientY - drag.current.y),
                  ),
                });
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              {failed || !photo.imageURL ? (
                <div className="ws-preview-failed">
                  <Info size={30} />
                  <p>{t("imageFailed")}</p>
                </div>
              ) : photo.mediaType === 1 ? (
                <video
                  key={photo.photoID}
                  src={photo.imageURL}
                  poster={photo.thumbnailURL || undefined}
                  controls
                  onError={() => setFailed(true)}
                />
              ) : (
                <img
                  key={photo.photoID}
                  src={photo.imageURL}
                  alt={photo.localPhotoName || t("photo")}
                  draggable={false}
                  onError={() => setFailed(true)}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  }}
                />
              )}
            </div>
            <button
              className="ws-next-photo"
              aria-label={t("nextPhoto")}
              disabled={index < 0 || index >= photos.length - 1}
              onClick={() => move(1)}
            >
              <ChevronRight />
            </button>
          </div>
          <div className="ws-viewer-tools">
            <div>
              <button
                aria-label={t("filmstrip")}
                title={t("filmstrip")}
                aria-pressed={strip}
                onClick={() => setStrip(!strip)}
              >
                <Rows3 size={18} />
              </button>
              {photo.mediaType === 0 && (
                <>
                  <button
                    aria-label={t("zoomOut")}
                    disabled={zoom <= 1}
                    onClick={() => setScale(zoom - 0.5)}
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button onClick={() => setScale(1)} title={t("fit")}>
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    aria-label={t("zoomIn")}
                    disabled={zoom >= 4}
                    onClick={() => setScale(zoom + 0.5)}
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button onClick={() => setScale(1)}>{t("fit")}</button>
                </>
              )}
            </div>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await download(photo);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Download size={17} />
              {t(busy ? "downloading" : "download")}
            </button>
          </div>
          {strip && (
            <div className="ws-filmstrip">
              {photos
                .slice(Math.max(0, index - 25), Math.max(50, index + 26))
                .map((p) => (
                  <button
                    key={p.photoID}
                    aria-label={`${t("openPhoto")} ${p.localPhotoName || p.photoID}`}
                    aria-current={p.photoID === photo.photoID}
                    onClick={() => onChoose(p.photoID)}
                  >
                    {p.thumbnailURL ? (
                      <img src={p.thumbnailURL} alt="" loading="lazy" />
                    ) : (
                      <Camera size={18} />
                    )}
                  </button>
                ))}
            </div>
          )}
        </div>
        {details && (
          <aside className="ws-photo-details">
            <h2>{t("details")}</h2>
            <div className="ws-record-note">
              <Info size={16} />
              <p>{t("recordNote")}</p>
            </div>
            <h3>{t("captureRecord")}</h3>
            <dl>
              {row(t("author"), photo.userName)}
              {row(
                t("takenAt"),
                captureTimeText ||
                  new Intl.DateTimeFormat(locale, {
                    timeZone: tz,
                    ...teamspaceDateOptions(locale, true),
                  }).format(photo.timestamp),
              )}
              {row(t("project"), photo.projectName)}
              {row(t("captureZone"), photo.timeZone)}
            </dl>
            <h3>
              <MapPin size={16} />
              {t("location")}
            </h3>
            <p className="ws-address">{photo.location || t("noLocation")}</p>
            {coordinate && (
              <>
                <code className="ws-coordinates">{coordinate}</code>
                <a
                  className="ws-map-link"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinate)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin size={25} />
                  <span>
                    {t("map")}
                    <small>{coordinate}</small>
                  </span>
                  <ExternalLink size={15} />
                </a>
              </>
            )}
            {(coordinate || photo.location) && (
              <button
                className="ws-link"
                onClick={() =>
                  copy([photo.location, coordinate].filter(Boolean).join("\n"))
                }
              >
                <Copy size={14} />
                {t(copied ? "copied" : "copy")}
              </button>
            )}
            <h3>{t("device")}</h3>
            <dl>
              {row(t("device"), photo.device)}
              {row(t("os"), photo.os)}
              {row(t("filename"), photo.localPhotoName)}
            </dl>
          </aside>
        )}
      </div>
    </WorkspaceDialog>
  );
}
