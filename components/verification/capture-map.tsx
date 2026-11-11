"use client"

import { useEffect, useRef, useState } from "react"
import type { Map as LeafletMap } from "leaflet"
import { MapPin } from "lucide-react"
import "leaflet/dist/leaflet.css"
import styles from "./record.module.css"

export default function CaptureMap({ latitude, longitude, label, unavailable }: {
  latitude: number; longitude: number; label: string; unavailable: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let map: LeafletMap | undefined
    let observer: ResizeObserver | undefined
    setFailed(false)
    import("leaflet").then(L => {
      if (cancelled || !container.current) return
      map = L.map(container.current, { scrollWheelZoom: false, zoomControl: false }).setView([latitude, longitude], 16)
      L.control.zoom({ position: "bottomright" }).addTo(map)
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        referrerPolicy: "strict-origin-when-cross-origin",
      }).on("tileerror", () => { if (!cancelled) setFailed(true) })
        .on("tileload", () => { if (!cancelled) setFailed(false) }).addTo(map)
      L.marker([latitude, longitude], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: styles.marker, html: "<span></span>", iconSize: [36, 46], iconAnchor: [18, 46] }),
      }).addTo(map)
      observer = new ResizeObserver(() => map?.invalidateSize())
      observer.observe(container.current)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; observer?.disconnect(); map?.remove() }
  }, [latitude, longitude])

  return <div className={styles.mapFrame}>
    <div ref={container} className={styles.map} role="region" aria-label={label} dir="ltr" />
    {failed && <div className={styles.mapUnavailable} role="status"><MapPin size={18} />{label} · {unavailable}</div>}
  </div>
}
