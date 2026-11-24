import { test, expect, type BrowserContext, type Page, type APIRequestContext } from "@playwright/test"

const origin = "https://h5.timeprint.net"
const local = process.env.ANALYTICS_TEST_BASE_URL || "http://127.0.0.1:3317"
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(local)) throw new Error("Analytics browser tests must target a local server")
// Deliberately unregistered ID. ALL collection requests are fulfilled locally.
const measurementId = process.env.ANALYTICS_TEST_MEASUREMENT_ID || "G-TEST000001"
const code = "AB12CD34EF56", second = "ZY98XW76VU54", task = "12345678-1234-4123-8123-123456789abc"
type Hit = Record<string, string>
type Harness = { hits: Hit[]; external: string[]; documents: string[]; enabled: boolean; blocked: boolean; errors: string[] }
let tag: string

test.beforeAll(async ({ request }) => {
  const response = await request.get(`https://www.googletagmanager.com/gtag/js?id=${measurementId}`)
  expect(response.ok()).toBeTruthy()
  tag = await response.text()
})

async function harness(context: BrowserContext, page: Page, request: APIRequestContext): Promise<Harness> {
  const state: Harness = { hits: [], external: [], documents: [], enabled: true, blocked: false, errors: [] }
  page.on("pageerror", error => state.errors.push(error.message))


  await context.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url())
    if (url.origin === origin || url.origin === "https://preview.example.test") {
      if (req.isNavigationRequest()) state.documents.push(url.pathname)
      if (url.pathname === "/api/config/verification-analytics") {
        return route.fulfill({ json: state.enabled ? { enabled: true, measurementId, streamId: "123456" } : { enabled: false } })
      }
      if (url.pathname === "/api/config/firebase-analytics") {
        // Keep ordinary Firebase disabled in this fixture. Its lifecycle is checked below.
        return route.fulfill({ json: { enabled: false, config: null } })
      }
      const response = await request.fetch(`${local}${url.pathname}${url.search}`, {
        method: req.method(), headers: { ...req.headers(), host: "h5.timeprint.net" },
        data: req.postDataBuffer() || undefined, maxRedirects: 0,
      })
      const headers = { ...response.headers() }
      delete headers["content-length"]
      // Browser routing intercepts only a redirect chain's first URL. Model the
      // same final navigation as Next's streaming meta redirect, so every hop
      // stays local instead of accidentally following the production hostname.
      if (response.status() >= 300 && response.status() < 400 && headers.location) {
        expect(headers.location).toMatch(/^\/(record|verify)\//)
        return route.fulfill({ status: 200, contentType: "text/html",
          body: `<meta http-equiv="refresh" content="0;url=${headers.location.replaceAll('"', '&quot;')}">` })
      }
      return route.fulfill({ response, headers })
    }
    state.external.push(decodeURIComponent(req.url() + " " + (req.postData() || "") + " " + (req.headers().referer || "")))
    if (url.hostname === "www.googletagmanager.com" && url.pathname === "/gtag/js") {
      expect(url.searchParams.get("id")).toBe(measurementId)
      return state.blocked ? route.abort() : route.fulfill({ contentType: "text/javascript", body: tag })
    }
    if (url.hostname.endsWith("google-analytics.com") && url.pathname.endsWith("collect")) {
      const common = Object.fromEntries(url.searchParams)
      for (const line of (req.postData() || "").split("\n")) state.hits.push({ ...common, ...Object.fromEntries(new URLSearchParams(line)) })
      return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } })
    }
    // No live analytics, ads, Firebase writes, COS requests or other external calls.
    return route.abort()
  })
  return state
}
const views = (state: Harness) => state.hits.filter(hit => hit.en === "page_view")
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    console.log("DEBUG", JSON.stringify(await page.evaluate(() => ({
      url: location.href, layer: (window as any).dataLayer?.map((x: any) => Array.from(x)),
      client: Boolean((window as any).timeprintVerificationAnalytics),
      disabled: (window as any)["ga-disable-G-TEST000001"],
    }))))
  }
})
async function settle(page: Page) { await page.waitForTimeout(1300) }
function privateCheck(state: Harness) {
  for (const hit of state.hits) {
    expect(hit.tid).toBe(measurementId)
    expect(hit.dl).toMatch(/^https:\/\/h5\.timeprint\.net\/_analytics\/(share_record|photo_record|verification_report)\/(browser|embedded)$/)
    expect(hit.dr || "").toBe("")
  }
  expect(state.external.join("\n")).not.toMatch(/AB12CD34EF56|ZY98XW76VU54|12345678-1234|private@example|22\.6789|secret-fragment|private-referrer/)
  expect(state.errors).toEqual([])
}
async function push(page: Page, path: string) {
  await page.evaluate(path => (window as any).next.router.push(path), path)
  await page.waitForURL(`${origin}${path}`)
}

for (const [route, category] of [[`/r/${code}`, "share_record"], [`/record/${code}`, "photo_record"], [`/verify/${task}`, "verification_report"]]) {
  for (const embedded of [false, true]) {
    test(`cold ${category} ${embedded ? "embedded" : "browser"} uses one safe page view`, async ({ context, page, request }) => {
      const state = await harness(context, page, request)
      await page.goto(`${origin}${route}?embed=${embedded ? 1 : 0}&email=private@example.com&lat=22.6789#secret-fragment`, { referer: `${origin}/r/private-referrer` })
      await expect.poll(() => views(state).length).toBe(1)
      await settle(page)
      expect(views(state)).toHaveLength(1)
      expect(views(state)[0].dl).toBe(`${origin}/_analytics/${category}/${embedded ? "embedded" : "browser"}`)
      // GA encodes first_visit/session_start as flags on the first collect request.
      expect(views(state)[0]._fv).toBe("1")
      expect(views(state)[0]._ss).toBe("1")
      privateCheck(state)
      expect(await page.locator("body").innerText()).toContain("Timeprint")
    })
  }
}

test("two photos, return, theme/language, refresh and automatic engagement", async ({ context, page, request }) => {
  const state = await harness(context, page, request)
  await page.goto(`${origin}/r/${code}`)
  await expect.poll(() => views(state).length).toBe(1)
  const clientId = views(state)[0].cid
  await push(page, `/r/${second}`)
  await expect.poll(() => views(state).length).toBe(2)
  expect(views(state)[1].cid).toBe(clientId)
  await push(page, `/r/${second}?lang=ar&theme=dark`)
  await page.evaluate(() => { document.title = "private@example.com"; location.hash = "secret-fragment" })
  await settle(page)
  expect(views(state)).toHaveLength(2)
  await page.goBack() // hash entry only
  await page.goBack() // language/theme entry only
  await page.goBack() // first photo
  await expect.poll(() => views(state).length).toBe(3)
  await page.reload()
  await expect.poll(() => views(state).length).toBe(4)
  // Automatic engagement time is attached by the SDK to later page views.
  expect(state.hits.some(hit => Number(hit._et) > 0)).toBe(true)
  // Probe an event without any page fields: it must inherit persistent safe
  // context, just like automatic events. This is not proof of GA ingestion.
  await page.evaluate(id => {
    document.title = "private@example.com"
    ;(window as any).gtag("event", "user_engagement", { send_to: id })
  }, measurementId)
  await expect.poll(() => state.hits.some(hit => hit.en === "user_engagement")).toBe(true)
  privateCheck(state)
})

test("/s counts only its final redirect and sample pages do not count", async ({ context, page, request }) => {
  const state = await harness(context, page, request)
  await page.goto(`${origin}/s/${code}?embed=1`)
  await expect(page).toHaveURL(new RegExp(`/record/${code}`))
  await expect.poll(() => views(state).length).toBe(1)
  expect(views(state)[0].dl).toBe(`${origin}/_analytics/photo_record/embedded`)
  await push(page, "/verification-example")
  await settle(page)
  expect(views(state)).toHaveLength(1)
  await push(page, `/record/${code}`)
  await expect.poll(() => views(state).length).toBe(2)
  privateCheck(state)
})

test("Next router crosses the ordinary/verification boundary with new documents", async ({ context, page, request }) => {
  const state = await harness(context, page, request)
  await page.goto(`${origin}/`)
  await page.waitForFunction(() => Boolean((window as any).next?.router))
  // Simulate a live old stream listener; it must never see the sensitive pathname.
  await page.evaluate(() => {
    const original = history.pushState.bind(history)
    history.pushState = (...args) => { original(...args); if (/^\/(r|record|verify)\//.test(location.pathname)) throw new Error("Old history listener reached sensitive path") }
    ;(window as any).ordinaryDocument = true
  })
  await push(page, `/r/${code}`)
  await expect.poll(() => views(state).length).toBe(1)
  expect(await page.evaluate(() => (window as any).ordinaryDocument)).toBeUndefined()
  expect(state.documents).toContain(`/r/${code}`)
  await push(page, "/")
  expect(await page.evaluate(() => (window as any).timeprintVerificationAnalytics)).toBeUndefined()
  await page.goBack()
  await expect.poll(() => views(state).length).toBe(2)
  privateCheck(state)
})

test("disabled config, blocked Google, opt-out and nonproduction hosts preserve reports", async ({ context, page, request }) => {
  const state = await harness(context, page, request)
  state.enabled = false
  await page.goto(`${origin}/record/${code}`)
  await settle(page)
  expect(state.hits).toHaveLength(0)
  expect(await page.locator("body").innerText()).toContain("Timeprint")
  state.enabled = true; state.blocked = true
  await page.reload(); await settle(page)
  expect(state.hits).toHaveLength(0)
  state.blocked = false
  await page.addInitScript(id => { (window as any)[`ga-disable-${id}`] = true }, measurementId)
  await page.reload(); await settle(page)
  expect(state.hits).toHaveLength(0)
  await page.goto(`https://preview.example.test/record/${code}`); await settle(page)
  expect(state.hits).toHaveLength(0)
  expect(state.errors).toEqual([])
})

test("prefetch and server requests do not emit browser visits; default runtime config is off", async ({ context, page, request }) => {
  const state = await harness(context, page, request)
  const config = await request.get(`${local}/api/config/verification-analytics`)
  expect(await config.json()).toEqual({ enabled: false })
  expect(config.headers()["cache-control"]).toBe("no-store")
  await page.goto(`${origin}/`)
  await page.waitForFunction(() => Boolean((window as any).next?.router))
  await page.evaluate(path => (window as any).next.router.prefetch(path), `/record/${code}`)
  await request.get(`${local}/record/${code}`, { headers: { "user-agent": "facebookexternalhit/1.1" } })
  await settle(page)
  expect(state.hits).toHaveLength(0)
})

test("existing denied consent is preserved without creating an analytics cookie", async ({ context, page, request }) => {
  const state = await harness(context, page, request)
  await page.addInitScript(() => {
    ;(window as any).dataLayer = []
    ;(window as any).gtag = function () { (window as any).dataLayer.push(arguments) }
    ;(window as any).gtag("consent", "default", {
      analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    })
  })
  await page.goto(`${origin}/record/${code}?email=private@example.com`)
  await settle(page)
  const consent = await page.evaluate(() => (window as any).dataLayer.filter((entry: any) => entry[0] === "consent").map((entry: any) => Array.from(entry)))
  expect(consent).toHaveLength(1)
  expect(consent[0][2].analytics_storage).toBe("denied")
  expect((await context.cookies()).some(cookie => cookie.name.startsWith("_ga"))).toBe(false)
  privateCheck(state)
})

test("bfcache restore is a new visit and rechecks the runtime off switch", async ({ context, page, request }) => {
  const state = await harness(context, page, request)
  await page.goto(`${origin}/record/${code}`)
  await expect.poll(() => views(state).length).toBe(1)
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })))
  await expect.poll(() => views(state).length).toBe(2)
  state.enabled = false
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })))
  await expect.poll(() => page.evaluate(id => (window as any)[`ga-disable-${id}`], measurementId)).toBe(true)
  await settle(page)
  expect(views(state)).toHaveLength(2)
  privateCheck(state)
})
