"use client"

import { useEffect, useRef, useState } from "react"
import type { Map as LeafletMap } from "leaflet"
import type { Map as VectorMap, StyleSpecification } from "maplibre-gl"
import { MapPin } from "lucide-react"
import "leaflet/dist/leaflet.css"
import "maplibre-gl/dist/maplibre-gl.css"
import styles from "./record.module.css"

export default function CaptureMap({ latitude, longitude, label, unavailable }: {
  latitude: number; longitude: number; label: string; unavailable: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let map: LeafletMap | undefined
    let vectorMap: VectorMap | undefined
    let observer: ResizeObserver | undefined
    let fallbackStarted = false
    let vectorLoaded = false
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    setFailed(false)
    // Preserve a usable map on browsers without WebGL or when the vector service
    // cannot load. Only this record map changes; the Team map is unaffected.
    const fallback = async () => {
      if (cancelled || fallbackStarted) return
      fallbackStarted = true
      clearTimeout(timeout)
      controller.abort()
      vectorMap?.remove()
      vectorMap = undefined
      const L = await import("leaflet")
      if (cancelled || !container.current) return
      container.current.replaceChildren()
      container.current.classList.remove("maplibregl-map")
      map = L.map(container.current, { scrollWheelZoom: false, zoomControl: false }).setView([latitude, longitude], 16)
      L.control.zoom({ position: "bottomright" }).addTo(map)
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        detectRetina: true,
        referrerPolicy: "strict-origin-when-cross-origin",
      }).on("tileerror", () => { if (!cancelled) setFailed(true) })
        .on("tileload", () => { if (!cancelled) setFailed(false) }).addTo(map)
      L.marker([latitude, longitude], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: styles.marker, html: "<span></span>", iconSize: [36, 46], iconAnchor: [18, 46] }),
      }).addTo(map)
    }
    const loadVector = async () => {
      const [M, response] = await Promise.all([
        import("maplibre-gl"),
        fetch("https://tiles.openfreemap.org/styles/liberty", { signal: controller.signal }),
      ])
      if (!response.ok) throw new Error("Map style unavailable")
      const style: StyleSpecification = await response.json()
      if (cancelled || fallbackStarted || !container.current) return
      // Keep Arabic/Hebrew place names readable as well; load shaping only when needed.
      if (M.getRTLTextPluginStatus() === "unavailable") {
        void M.setRTLTextPlugin("https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js", true)
          .catch(() => fallback().catch(() => { if (!cancelled) setFailed(true) }))
      }
      // Draw readable local place/road labels at the actual display pixel density.
      // Raster retina mode sharpens imagery but halves the label's CSS font size.
      for (const layer of style.layers) {
        if (layer.type !== "symbol" || !layer.layout) continue
        if (layer.id.startsWith("highway-name") || layer.id.startsWith("poi_")) {
          layer.layout["text-field"] = ["coalesce", ["get", "name"], ["get", "name:latin"]]
          layer.layout["text-size"] = layer.id.startsWith("highway-name") ? 14 : 13
          layer.layout["text-font"] = ["Noto Sans Regular"]
          layer.layout["icon-optional"] = true
          layer.paint = { ...layer.paint, "text-color": "#334155", "text-halo-color": "#ffffff", "text-halo-width": 1.5 }
        }
      }
      vectorMap = new M.Map({
        container: container.current, style, center: [longitude, latitude], zoom: 15,
        scrollZoom: false, dragRotate: false, touchPitch: false,
        attributionControl: { compact: false },
        // MapLibre defaults to devicePixelRatio, including 2x and 3x phones.
      })
      vectorMap.touchZoomRotate.disableRotation()
      vectorMap.addControl(new M.NavigationControl({ showCompass: false }), "bottom-right")
      const marker = document.createElement("div")
      marker.className = styles.marker
      marker.appendChild(document.createElement("span"))
      new M.Marker({ element: marker, anchor: "bottom" }).setLngLat([longitude, latitude]).addTo(vectorMap)
      vectorMap.once("load", () => { vectorLoaded = true; clearTimeout(timeout); if (!cancelled) setFailed(false) })
      vectorMap.on("error", () => { if (!vectorLoaded) void fallback().catch(() => { if (!cancelled) setFailed(true) }) })
    }
    timeout = setTimeout(() => { if (!vectorLoaded) void fallback().catch(() => { if (!cancelled) setFailed(true) }) }, 15000)
    void loadVector().catch(() => fallback().catch(() => { if (!cancelled) setFailed(true) }))
    if (container.current) {
      observer = new ResizeObserver(() => { map?.invalidateSize(); vectorMap?.resize() })
      observer.observe(container.current)
    }
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); observer?.disconnect(); vectorMap?.remove(); map?.remove() }
  }, [latitude, longitude])

  return <div className={styles.mapFrame}>
    <div ref={container} className={styles.map} role="region" aria-label={label} dir="ltr" />
    {failed && <div className={styles.mapUnavailable} role="status"><MapPin size={18} />{label} · {unavailable}</div>}
  </div>
}
