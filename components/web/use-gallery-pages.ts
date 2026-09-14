"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WebPhoto } from "./photo-gallery";
import {
  defaultFilters,
  type GalleryFilters,
  type GalleryScope,
} from "@/lib/web/gallery";
export type PageResult = {
  photos: WebPhoto[];
  total: number;
  page: number;
  snapshot: string;
};
export function useGalleryPages(
  scope: GalleryScope,
  initial: WebPhoto[],
  total: number,
  initialSnapshot: string,
  filters: GalleryFilters,
  page: number,
  locale: string,
  ready: boolean,
) {
  const [data, setData] = useState<PageResult>({
      photos: initial,
      total,
      page: 1,
      snapshot: initialSnapshot,
    }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [facets, setFacets] = useState<{
      projects: string[][];
      members: string[][];
    }>({ projects: [], members: [] });
  const snapshot = useRef(initialSnapshot),
    cache = useRef(new Map<string, PageResult>()),
    generation = useRef(0);
  const scopeKey = JSON.stringify(scope),
    filterKey = JSON.stringify(filters),
    queryKey = `${scopeKey}:${locale}:${filterKey}`,
    lastQuery = useRef(queryKey);
  const [neighbors, setNeighbors] = useState<WebPhoto[]>([]);
  const [loadedKey, setLoadedKey] = useState(
    `${scopeKey}:${locale}:${JSON.stringify(defaultFilters)}:1`,
  );
  const key = `${queryKey}:${page}`;
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    cache.current.set(
      `${scopeKey}:${locale}:${JSON.stringify({ q: "", project: "", member: "", from: "", to: "", type: "", sort: "desc" })}:1`,
      { photos: initial, total, page: 1, snapshot: initialSnapshot },
    );
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/web/photos/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, mode: "facets" }),
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(setFacets)
      .catch(() => {});
    return () => controller.abort();
  }, [scopeKey]);
  useEffect(() => {
    if (!ready) return;
    const serial = ++generation.current,
      controller = new AbortController();
    if (lastQuery.current !== queryKey) {
      lastQuery.current = queryKey;
      setNeighbors([]);
    }
    const cached = cache.current.get(key);
    setError(false);
    if (cached) {
      setData(cached);
      setLoadedKey(key);
      setLoading(false);
    } else setLoading(true);
    const timer = setTimeout(
      async () => {
        let foregroundDone = Boolean(cached);
        try {
          const request = async (n: number) => {
            const r = await fetch("/api/web/photos/list", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                scope,
                filters,
                page: n,
                locale,
                snapshot: snapshot.current || undefined,
              }),
              signal: controller.signal,
            });
            if (!r.ok) throw Error("LOAD_FAILED");
            return (await r.json()) as PageResult;
          };
          const result = cached || (await request(page));
          if (controller.signal.aborted || serial !== generation.current)
            return;
          snapshot.current = result.snapshot;
          cache.current.set(key, result);
          while (cache.current.size > 6)
            cache.current.delete(cache.current.keys().next().value!);
          setData(result);
          setLoadedKey(key);
          setLoading(false);
          foregroundDone = true;
          // One adjacent page is prefetched after foreground work; no unbounded accumulation.
          const next = result.page + 1,
            nextKey = `${queryKey}:${next}`;
          if (next <= Math.ceil(result.total / 48)) {
            const neighbor =
              cache.current.get(nextKey) || (await request(next));
            if (controller.signal.aborted || serial !== generation.current)
              return;
            cache.current.set(nextKey, neighbor);
            while (cache.current.size > 6)
              cache.current.delete(cache.current.keys().next().value!);
            setNeighbors(neighbor.photos);
          } else setNeighbors([]);
        } catch (e) {
          if (controller.signal.aborted || serial !== generation.current)
            return;
          if (!foregroundDone) {
            setError(true);
            setLoading(false);
          }
        }
      },
      filters.q ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, ready, retry]);
  const preview = useMemo(
    () => [
      ...data.photos,
      ...neighbors.filter(
        (p) => !data.photos.some((x) => x.photoID === p.photoID),
      ),
    ],
    [data.photos, neighbors],
  );
  return {
    data,
    loading: (loading || (ready && loadedKey !== key)) && !error,
    error,
    facets,
    preview,
    snapshot,
    reload: () => {
      cache.current.delete(key);
      setRetry((n) => n + 1);
    },
  };
}
