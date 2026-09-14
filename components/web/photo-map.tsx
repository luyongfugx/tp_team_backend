"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { WebPhoto } from "./photo-gallery";
import type { ShareCopy } from "@/lib/web/share-copy";
import { validCoordinates } from "@/lib/web/gallery";
import { MapPin, ImageOff } from "lucide-react";
import "leaflet/dist/leaflet.css";
export function PhotoMap({
  photos,
  onOpen,
  t,
}: {
  photos: WebPhoto[];
  onOpen: (id: string) => void;
  t: ShareCopy;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null),
    open = useRef(onOpen);
  open.current = onOpen;
  const [limit, setLimit] = useState(100);
  const [failed, setFailed] = useState(false),
    [selected, setSelected] = useState("");
  const located = useMemo(() => photos.filter(validCoordinates), [photos]);
  const groups = useMemo(() => {
    const result = new Map<string, typeof located>();
    for (const p of located) {
      const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      result.set(key, [...(result.get(key) || []), p]);
    }
    return [...result.entries()];
  }, [located]);
  useEffect(() => {
    if (!container.current || !located.length) return;
    let cancelled = false;
    setFailed(false);
    import("leaflet")
      .then((L) => {
        if (cancelled || !container.current) return;
        const m = L.map(container.current, { scrollWheelZoom: false });
        map.current = m;
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          },
        ).addTo(m);
        tiles.on("tileerror", () => setFailed(true));
        for (const [key, items] of groups) {
          const p = items[0];
          L.marker([p.lat, p.lng], {
            icon: L.divIcon({
              className: "share-map-marker",
              html: `<span>${items.length}</span>`,
              iconSize: [34, 34],
              iconAnchor: [17, 34],
            }),
          })
            .addTo(m)
            .on("click", () => {
              setSelected(key);
              setLimit(100);
              m.panTo([p.lat, p.lng]);
            });
        }
        m.fitBounds(L.latLngBounds(located.map((p) => [p.lat, p.lng])), {
          padding: [45, 45],
          maxZoom: 15,
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [located, groups]);
  const items =
    (groups.find(([key]) => key === selected) || groups[0])?.[1] || [];
  return !located.length ? (
    <div className="share-empty">
      <MapPin />
      <h2>{t("noMap")}</h2>
    </div>
  ) : (
    <div className="share-map-layout">
      <div className="share-map-canvas" ref={container} aria-label={t("map")} />
      <aside className="share-map-list">
        <h2>
          <MapPin size={17} />
          {t("location")} · {groups.length}
        </h2>
        {failed && <p role="status">{t("mapError")}</p>}
        {photos.length > located.length && (
          <p>
            {photos.length - located.length} {t("missingGps")}
          </p>
        )}
        <select
          aria-label={t("location")}
          value={
            groups.some(([key]) => key === selected) ? selected : groups[0]?.[0]
          }
          onChange={(e) => {
            setSelected(e.target.value);
            setLimit(100);
            const p = groups.find(([key]) => key === e.target.value)?.[1][0];
            if (p) map.current?.setView([p.lat, p.lng], 15);
          }}
        >
          {groups.map(([key, p]) => (
            <option key={key} value={key}>
              {p[0].location || key} ({p.length})
            </option>
          ))}
        </select>
        <p>{items[0]?.location}</p>
        {items.slice(0, limit).map((p) => (
          <button
            className="share-map-photo"
            key={p.photoID}
            onClick={() => open.current(p.photoID)}
          >
            {p.thumbnailURL ? (
              <img src={p.thumbnailURL} alt="" loading="lazy" />
            ) : (
              <ImageOff />
            )}
            <span>
              <strong>{p.userName || t("photo")}</strong>
              <small>{p.timeText}</small>
            </span>
          </button>
        ))}
        {items.length > limit && (
          <button
            className="share-map-more"
            onClick={() => setLimit((n) => n + 100)}
          >
            {t("more")} ({items.length - limit})
          </button>
        )}
      </aside>
    </div>
  );
}
