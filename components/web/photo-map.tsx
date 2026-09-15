"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { WebPhoto } from "./photo-gallery";
import type { ShareCopy } from "@/lib/web/share-copy";
import type { GalleryFilters, GalleryScope } from "@/lib/web/gallery";
import { MapPin, ImageOff } from "lucide-react";
import "leaflet/dist/leaflet.css";
type Point = { lat: number; lng: number; count: number };
export function PhotoMap({
  scope,
  filters,
  snapshot,
  locale,
  onOpen,
  t,
}: {
  scope: GalleryScope;
  filters: GalleryFilters;
  snapshot: string;
  locale: string;
  onOpen: (id: string) => void;
  t: ShareCopy;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null);
  const [points, setPoints] = useState<Point[]>([]),
    [pointPage, setPointPage] = useState(1),
    [morePoints, setMorePoints] = useState(false);
  const [counts, setCounts] = useState({ located: 0, total: 0 }),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false),
    [tilesFailed, setTilesFailed] = useState(false);
  const [selected, setSelected] = useState<Point | null>(null),
    [photoPage, setPhotoPage] = useState(1),
    [photos, setPhotos] = useState<WebPhoto[]>([]),
    [photoTotal, setPhotoTotal] = useState(0),
    [photoLoading, setPhotoLoading] = useState(false),
    [photoFailed, setPhotoFailed] = useState(false),
    [retry, setRetry] = useState(0);
  const query = JSON.stringify({ scope, filters, snapshot, locale });
  const latest = useRef(query);
  latest.current = query;
  useEffect(() => {
    setLoading(true);
    setFailed(false);
    const controller = new AbortController();
    const identity = query;
    fetch("/api/web/photos/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...JSON.parse(query),
        mode: "map",
        page: pointPage,
      }),
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        if (controller.signal.aborted || latest.current !== identity) return;
        setPoints((old) =>
          pointPage === 1
            ? d.points
            : [
                ...new Map(
                  [...old, ...d.points].map((p: Point) => [
                    `${p.lat},${p.lng}`,
                    p,
                  ]),
                ).values(),
              ],
        );
        setCounts({ located: d.located, total: d.total });
        setMorePoints(d.hasMore);
        if (pointPage === 1) {
          setSelected(d.points[0] || null);
          setPhotoPage(1);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [query, pointPage, retry]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setPhotoLoading(true);
    setPhotoFailed(false);
    if (photoPage === 1) setPhotos([]);
    fetch("/api/web/photos/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...JSON.parse(query),
        mode: "location",
        lat: selected.lat,
        lng: selected.lng,
        page: photoPage,
      }),
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        if (controller.signal.aborted) return;
        setPhotos((old) =>
          photoPage === 1
            ? d.photos
            : [
                ...new Map(
                  [...old, ...d.photos].map((p: WebPhoto) => [p.photoID, p]),
                ).values(),
              ],
        );
        setPhotoTotal(d.total);
        setPhotoLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPhotoFailed(true);
          setPhotoLoading(false);
        }
      });
    return () => controller.abort();
  }, [query, selected, photoPage, retry]);
  useEffect(() => {
    if (!container.current || !points.length) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    import("leaflet")
      .then((L) => {
        if (cancelled || !container.current) return;
        const m = L.map(container.current, { scrollWheelZoom: false });
        map.current = m;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          detectRetina: true,
        })
          .on("tileerror", () => {
            if (!cancelled) setTilesFailed(true);
          })
          .addTo(m);
        const layer = L.layerGroup().addTo(m);
        // Render one marker per visible screen cell; point data does not load images.
        const draw = () => {
          layer.clearLayers();
          const cells = new Map<string, Point[]>();
          for (const p of points) {
            if (!m.getBounds().pad(0.15).contains([p.lat, p.lng])) continue;
            const px = m.project([p.lat, p.lng]);
            const key = `${Math.floor(px.x / 48)},${Math.floor(px.y / 48)}`;
            const cell = cells.get(key) || [];
            cell.push(p);
            cells.set(key, cell);
          }
          for (const cell of cells.values()) {
            const p = cell[0],
              count = cell.reduce((n, p) => n + p.count, 0);
            L.marker([p.lat, p.lng], {
              icon: L.divIcon({
                className: "share-map-marker",
                html: `<span>${count}</span>`,
                iconSize: [34, 34],
                iconAnchor: [17, 34],
              }),
            })
              .addTo(layer)
              .on("click", () => {
                setSelected(p);
                setPhotoPage(1);
                if (cell.length > 1 && m.getZoom() < m.getMaxZoom())
                  m.fitBounds(L.latLngBounds(cell.map((p) => [p.lat, p.lng])), {
                    padding: [35, 35],
                    maxZoom: m.getZoom() + 3,
                  });
                else m.panTo([p.lat, p.lng]);
              });
          }
        };
        m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), {
          padding: [45, 45],
          maxZoom: 15,
        });
        draw();
        m.on("moveend", draw);
        const resize = new ResizeObserver(() => m.invalidateSize());
        resize.observe(container.current);
        dispose = () => {
          resize.disconnect();
          m.remove();
        };
      })
      .catch(() => {
        if (!cancelled) setTilesFailed(true);
      });
    return () => {
      cancelled = true;
      dispose?.();
      map.current = null;
    };
  }, [points]);
  const displayed = points.reduce((n, p) => n + p.count, 0);
  return (
    <div>
      <p className="share-map-page-note">
        {t("results")} · {displayed} / {counts.total} {t("count")}
        {counts.total > counts.located &&
          ` · ${counts.total - counts.located} ${t("missingGps")}`}
      </p>
      {failed && (
        <p role="alert">
          {t("loadFailed")}{" "}
          <button onClick={() => setRetry((n) => n + 1)}>{t("retry")}</button>
        </p>
      )}
      {loading && <p role="status">{t("loading")}</p>}
      {!loading && !failed && !points.length ? (
        <div className="share-empty">
          <MapPin />
          <h2>{t("noMap")}</h2>
        </div>
      ) : (
        <div className="share-map-layout">
          <div
            className="share-map-canvas"
            ref={container}
            aria-label={t("map")}
          />
          <aside className="share-map-list">
            <h2>
              <MapPin size={17} />
              {t("location")} · {points.length}
            </h2>
            {tilesFailed && <p role="status">{t("mapError")}</p>}
            <select
              aria-label={t("location")}
              value={selected ? `${selected.lat},${selected.lng}` : ""}
              onChange={(e) => {
                const p = points.find(
                  (p) => `${p.lat},${p.lng}` === e.target.value,
                );
                if (p) {
                  setSelected(p);
                  setPhotoPage(1);
                  map.current?.setView([p.lat, p.lng], 15);
                }
              }}
            >
              {points.map((p) => (
                <option key={`${p.lat},${p.lng}`} value={`${p.lat},${p.lng}`}>
                  {p.lat.toFixed(5)}, {p.lng.toFixed(5)} ({p.count})
                </option>
              ))}
            </select>
            <p>{photos[0]?.location}</p>
            {photos.map((p) => (
              <button
                className="share-map-photo"
                key={p.photoID}
                onClick={() => onOpen(p.photoID)}
              >
                {p.thumbnailURL ? (
                  <img
                    src={p.thumbnailURL}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <ImageOff />
                )}
                <span>
                  <strong>{p.userName || t("photo")}</strong>
                  <small>{p.timeText}</small>
                </span>
              </button>
            ))}
            {photoLoading && <p role="status">{t("loading")}</p>}
            {photoFailed && (
              <p role="alert">
                {t("loadFailed")}{" "}
                <button onClick={() => setRetry((n) => n + 1)}>
                  {t("retry")}
                </button>
              </p>
            )}
            {!photoLoading && !photoFailed && photos.length < photoTotal && (
              <button
                className="share-map-more"
                onClick={() => setPhotoPage((n) => n + 1)}
              >
                {t("more")} ({photos.length}/{photoTotal})
              </button>
            )}
          </aside>
        </div>
      )}
      {morePoints && !failed && (
        <button
          className="share-map-more"
          disabled={loading}
          onClick={() => setPointPage((n) => n + 1)}
        >
          {t("more")} · {t("location")} ({displayed}/{counts.located})
        </button>
      )}
    </div>
  );
}
