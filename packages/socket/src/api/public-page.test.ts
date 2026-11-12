import fs from "node:fs"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { app } from "@razzia/socket/app"
import { getPath } from "@razzia/socket/services/config"
beforeEach(() => {
  const file = getPath("shell.html")
  fs.writeFileSync(
    file,
    '<html><head><title>Razzia</title><link id="favicon" rel="icon" href="/icon.svg" /></head><body><script src="/assets/app.js"></script></body></html>',
  )
  vi.stubEnv("WEB_INDEX_PATH", file)
  vi.stubEnv("PUBLIC_ORIGIN", "https://training.example")
  fs.mkdirSync(getPath("branding"), { recursive: true })
  fs.rmSync(getPath("branding/theme.json"), { force: true })
})
afterEach(() => vi.unstubAllEnvs())
it("serves configured public metadata to an anonymous crawler without JavaScript", async () => {
  fs.writeFileSync(
    getPath("branding/theme.json"),
    JSON.stringify({
      appName: "Training & Safety",
      favicon: "/branding/icon.png",
      logo: "/branding/other.png",
    }),
  )
  const r = await app.request("http://internal/api/page?pin=123456", {
    headers: { "User-Agent": "facebookexternalhit/1.1" },
  })
  expect(r.status).toBe(200)
  expect(r.headers.get("Cache-Control")).toBe("no-store")
  const html = await r.text()
  expect(html).toContain('property="og:title" content="Training &amp; Safety"')
  expect(html).toContain(
    'property="og:image" content="https://training.example/branding/icon.png"',
  )
  expect(html).toContain(
    'property="og:url" content="https://training.example/"',
  )
  expect(html).not.toContain("123456")
  expect(html).toContain("/assets/app.js")
})
it("reads updates on the next request and restores original defaults", async () => {
  const theme = getPath("branding/theme.json")
  fs.writeFileSync(
    theme,
    JSON.stringify({
      appName: "First",
      favicon: "https://images.example/first.png",
    }),
  )
  expect(await (await app.request("/api/page")).text()).toContain(
    'content="First"',
  )
  fs.writeFileSync(
    theme,
    JSON.stringify({
      appName: "Second",
      favicon: "https://images.example/second.png",
    }),
  )
  expect(await (await app.request("/api/page")).text()).toContain(
    'content="Second"',
  )
  fs.rmSync(theme)
  expect(await (await app.request("/api/page")).text()).toContain(
    'content="https://training.example/icon.svg"',
  )
  fs.writeFileSync(theme, "invalid JSON")
  expect(await (await app.request("/api/page")).text()).toContain(
    'content="Razzia"',
  )
})
