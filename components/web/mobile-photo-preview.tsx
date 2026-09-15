"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type PointerEvent } from "react";
import { Info, X, Download, ZoomIn, ZoomOut } from "lucide-react";
import { PhotoPreview } from "@/components/workspace/photo-preview";
import { WorkspaceDialog } from "@/components/workspace/dialog";
import { ImageGesture, boundTransform } from "@/lib/web/lightbox-gesture";
import { isRTLTeamspaceLocale } from "@/lib/teamspace/translations";

type Props = ComponentProps<typeof PhotoPreview>;
const subscribe = (update: () => void) => {
  const query = window.matchMedia("(max-width: 760px)");
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
};
export function SharedPhotoPreview(props: Props) {
  const mobile = useSyncExternalStore(subscribe, () => window.matchMedia("(max-width: 760px)").matches, () => false);
  return mobile ? <MobilePhotoPreview key={props.photo.photoID} {...props} /> : <PhotoPreview {...props} />;
}
function MobilePhotoPreview(props: Props) {
  const { photo, photos, onChoose, onClose, t, locale, download, captureTimeText } = props;
  const [details, setDetails] = useState(false), [failed, setFailed] = useState(false), [busy, setBusy] = useState(false);
  const [, redraw] = useState(0);
  const gesture = useRef(new ImageGesture()), stage = useRef<HTMLDivElement>(null), image = useRef<HTMLImageElement>(null);
  const tap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frame = useRef(0);
  const isVideo = photo.mediaType === 1;
  const index = photos.findIndex(item => item.photoID === photo.photoID);
  const rtl = isRTLTeamspaceLocale(locale);
  const bounds = () => {
    const width = stage.current?.clientWidth || 1, height = stage.current?.clientHeight || 1;
    const naturalWidth = image.current?.naturalWidth || width, naturalHeight = image.current?.naturalHeight || height;
    const fit = Math.min(width / naturalWidth, height / naturalHeight);
    return { width, height, imageWidth: naturalWidth * fit, imageHeight: naturalHeight * fit };
  };
  const render = () => { if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; redraw(value => value + 1); }); };
  const move = (delta: number) => { const next = photos[index + delta]; if (next) onChoose(next.photoID); };
  const clearTap = () => { clearTimeout(tap.current); tap.current = undefined; };
  useEffect(() => () => { clearTimeout(tap.current); cancelAnimationFrame(frame.current); }, []);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      gesture.current.transform = boundTransform(gesture.current.transform, bounds());
      render();
    });
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLVideoElement) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); move((event.key === "ArrowRight" ? 1 : -1) * (rtl ? -1 : 1));
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const point = (event: PointerEvent) => {
    const rect = stage.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
  };
  const zoom = (scale: number) => { clearTap(); gesture.current.zoom(scale, bounds()); render(); };
  const transform = gesture.current.transform;
  const row = (label: string, value?: string | null) => value ? <div><dt>{label}</dt><dd>{value}</dd></div> : null;
  return <WorkspaceDialog label={t("openPhoto")} onClose={details ? () => setDetails(false) : onClose} className="share-lightbox" initialFocus="dialog">
    <div className="share-lightbox-stage" ref={stage}
      onPointerDown={event => {
        if (isVideo || details || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        clearTimeout(tap.current);
        gesture.current.down(event.pointerId, point(event));
        // A second finger must cancel a pending single tap.
        if (!event.isPrimary) clearTap();
      }}
      onPointerMove={event => { if (!isVideo && !details) { const before = gesture.current.transform; gesture.current.move(event.pointerId, point(event), bounds()); if (before !== gesture.current.transform) render(); } }}
      onPointerUp={event => {
        if (isVideo || details) return;
        const action = gesture.current.up(event.pointerId, point(event), bounds());
        render();
        if (action === "tap") {
          if (tap.current) { clearTap(); zoom(transform.scale > 1 ? 1 : 2); }
          else tap.current = setTimeout(onClose, 280);
        } else {
          clearTap();
          if (action) move((action === "next" ? 1 : -1) * (rtl ? -1 : 1));
        }
      }}
      onPointerCancel={() => { gesture.current.cancel(); clearTap(); }}
    >
      {failed || !photo.imageURL ? <p className="share-lightbox-error"><Info /><span>{t("imageFailed")}</span></p> : isVideo ?
        <video src={photo.imageURL} poster={photo.thumbnailURL || undefined} controls playsInline onError={() => setFailed(true)} /> :
        <img ref={image} src={photo.imageURL} alt={photo.localPhotoName || t("photo")} draggable={false} onError={() => setFailed(true)} style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }} />}
    </div>
    <div className="share-lightbox-buttons">
      <button aria-label={details ? t("hideDetails") : t("details")} aria-expanded={details} onClick={() => { clearTap(); gesture.current.cancel(); setDetails(value => !value); }}><Info size={20} /></button>
      <button aria-label={t("close")} onClick={onClose}><X size={23} /></button>
    </div>
    {details && <>
    <button
      className="share-lightbox-details-backdrop"
      aria-label={t("hideDetails")}
      tabIndex={-1}
      onPointerDown={event => event.preventDefault()}
      onClick={() => { clearTap(); gesture.current.cancel(); setDetails(false); }}
    />
    <aside className="share-lightbox-details" aria-label={t("details")}>
      <h2>{t("details")}</h2>
      <p className="share-lightbox-record-note">{t("recordNote")}</p>
      <dl>{row(t("takenAt"), captureTimeText)}{row(t("captureZone"), photo.timeZone)}{row(t("project"), photo.projectName)}{row(t("member"), photo.userName)}{row(t("location"), photo.location)}{row("GPS", photo.lat != null && photo.lng != null ? `${photo.lat}, ${photo.lng}` : null)}{row(t("device"), photo.device)}{row(t("os"), photo.os)}{row(t("filename"), photo.localPhotoName)}</dl>
      <div className="share-lightbox-detail-actions">
        {!isVideo && <><button aria-label={t("zoomOut")} onClick={() => zoom(transform.scale - .5)}><ZoomOut /></button><button aria-label={t("zoomIn")} onClick={() => zoom(transform.scale + .5)}><ZoomIn /></button></>}
        <button disabled={busy} onClick={async () => { setBusy(true); try { await download(photo); } finally { setBusy(false); } }}><Download size={18} />{t("download")}</button>
      </div>
    </aside></>}
  </WorkspaceDialog>;
}
