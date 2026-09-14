"use client";
import { useEffect, useState } from "react";
// Local-only visible instrumentation for reproducible scrolling / navigation QA.
export function GalleryPerformanceProbe() {
  const [stats, setStats] = useState<{
    frames: number;
    p95: number;
    slow: number;
    long: number;
    requests: number;
    documents: number;
    cards: number;
  } | null>(null);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "development" ||
      new URLSearchParams(location.search).get("perf") !== "1"
    )
      return;
    let last = 0,
      frames: number[] = [],
      slow = 0,
      long = 0,
      raf = 0;
    const tick = (now: number) => {
      if (last && document.visibilityState === "visible") {
        const delta = now - last;
        frames.push(delta);
        if (delta > 50) slow++;
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const observer = new PerformanceObserver((list) => {
      long += list.getEntries().length;
    });
    if (PerformanceObserver.supportedEntryTypes.includes("longtask"))
      observer.observe({ type: "longtask", buffered: false });
    const timer = setInterval(() => {
      const sorted = [...frames].sort((a, b) => a - b);
      setStats({
        frames: frames.length,
        p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] || 0),
        slow,
        long,
        requests: performance
          .getEntriesByType("resource")
          .filter((e) => e.name.includes("/api/web/photos/list")).length,
        documents: performance.getEntriesByType("navigation").length,
        cards: document.querySelectorAll(".share-photo").length,
      });
      if (frames.length > 10000) frames = frames.slice(-5000);
    }, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      observer.disconnect();
    };
  }, []);
  return stats ? (
    <output
      className="share-perf-probe"
      style={{
        position: "fixed",
        bottom: 4,
        right: 4,
        zIndex: 1001,
        background: "#172b45",
        color: "white",
        padding: "8px 12px",
        fontSize: 11,
        borderRadius: 6,
        pointerEvents: "none",
      }}
    >
      性能测试 · frames {stats.frames} · p95 {stats.p95} ms · &gt;50ms{" "}
      {stats.slow} · long tasks {stats.long} · requests {stats.requests} ·
      documents {stats.documents} · cards {stats.cards}
    </output>
  ) : null;
}
