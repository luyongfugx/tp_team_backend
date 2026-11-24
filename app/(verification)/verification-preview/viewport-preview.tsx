"use client"

import { useEffect, useRef, useState } from "react"

/** Development-only viewport evidence. The parent route rejects production requests. */
export default function ViewportPreview({ width, height, src }: { width: number; height: number; src: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [result, setResult] = useState("Loading…")
  useEffect(() => {
    const timer = window.setInterval(() => {
      const document = frame.current?.contentDocument
      if (document?.readyState === "complete" && document.querySelector("[data-report-state]")) { inspect(); window.clearInterval(timer) }
    }, 200)
    return () => window.clearInterval(timer)
  }, [src])
  const scale = Math.min(1, 1100 / width)
  function inspect() {
    const document = frame.current?.contentDocument, win = frame.current?.contentWindow
    if (!document || !win) return
    const outside = Array.from(document.querySelectorAll("main *, header *")).filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && (rect.left < -1 || rect.right > win.innerWidth + 1)
    }).map(element => element.tagName + ": " + element.textContent?.slice(0, 40))
    const clipped = Array.from(document.querySelectorAll("h1,h2,h3,p,strong,button,select,dt,dd")).filter(element =>
      element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1 && win.getComputedStyle(element).clipPath !== "inset(50%)"
    ).map(element => element.tagName + ": " + element.textContent?.slice(0, 40))
    const page = document.querySelector("[data-report-state]")
    const code = document.querySelector("strong[dir=ltr]"), capture = document.querySelector("[data-paired]")
    if (!page) return
    const panel = document.querySelector("[data-tone]"), hero = document.querySelector("section[aria-labelledby=report-title]")
    const photoCode = code?.closest("button"), originalInfo = document.querySelector("[data-original-info]"), firstMetadata = originalInfo?.querySelector("dd")
    const position = (element: Element | null | undefined) => element ? Math.round(element.getBoundingClientRect().bottom + win.scrollY) : null
    const sample = document.querySelector("aside[role=note]")
    const sampleHeight = sample ? sample.getBoundingClientRect().height + parseFloat(win.getComputedStyle(sample).marginBottom) : 0
    setResult(JSON.stringify({ width: win.innerWidth, direction: page.getAttribute("dir"), overflow: document.documentElement.scrollWidth > win.innerWidth,
      outside, clipped, codeDirection: code ? win.getComputedStyle(code).direction : null,
      captureColumns: capture ? win.getComputedStyle(capture).gridTemplateColumns : null,
      height: win.innerHeight, languageOptions: document.querySelectorAll("header select option").length,
      firstScreen: { codeBottom: position(photoCode), infoTitleBottom: position(originalInfo?.querySelector("h2")), timeBottom: position(firstMetadata) },
      sampleNoticeHeight: Math.round(sampleHeight),
      palette: { theme: page.getAttribute("data-theme"), background: win.getComputedStyle(page).backgroundColor,
        canvas: win.getComputedStyle(document.documentElement).backgroundColor, body: win.getComputedStyle(document.body).backgroundColor,
        panel: panel ? win.getComputedStyle(panel).backgroundColor : null,
        header: hero ? win.getComputedStyle(hero).backgroundColor : null } }, null, 2))
  }
  return <main style={{ padding: 16, background: "#e7edf4", color: "#15243a", minHeight: "100vh" }}>
    <p>Development preview · {width}px · <a href={src}>Open report</a> · <button disabled={result === "Loading…"} onClick={inspect}>Inspect layout</button> · <button onClick={() => frame.current?.contentDocument?.getElementById("trust-title")?.scrollIntoView()}>Show explanation</button></p>
    <pre aria-label="Layout inspection" style={{ whiteSpace: "pre-wrap", margin: "12px 0" }}>{result}</pre>
    <div style={{ width: width * scale, height: height * scale, margin: "auto" }}>
      <iframe ref={frame} title={`Report at ${width}px`} src={src} onLoad={inspect} style={{ width, height, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }} />
    </div>
  </main>
}
