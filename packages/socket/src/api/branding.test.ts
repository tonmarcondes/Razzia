import { SESSION_ROLES } from "@razzia/common/constants"
import { BRANDING_ASSET_MAX_SIZE } from "@razzia/common/validators/branding"
import { app } from "@razzia/socket/app"
import { mintToken } from "@razzia/socket/services/auth"
import { getPath, initConfig } from "@razzia/socket/services/config"
import fs from "fs"
import { join } from "path"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"

let manager = "",
  player = ""
const call = (method = "GET", body?: unknown, token = manager) =>
  app.request("/api/branding", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined || method === "GET"
      ? {}
      : { body: JSON.stringify(body) }),
  })
const current = async () =>
  (await (await call()).json()) as {
    theme: Record<string, unknown>
    revision: string
  }
const upload = (file: File, token = manager) => {
  const form = new FormData()
  form.append("file", file)

  return app.request("/api/branding/assets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
}
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000",
  "hex",
)
beforeAll(async () => {
  manager = (await mintToken("branding-manager", SESSION_ROLES.MANAGER)).token
  player = (await mintToken("branding-player", SESSION_ROLES.PLAYER)).token
})
beforeEach(() => {
  fs.rmSync(getPath(), { recursive: true, force: true })
  initConfig()
  fs.writeFileSync(getPath("sentinel.txt"), "keep")
})

describe("appearance management", () => {
  it.each(["GET", "PUT", "DELETE"])(
    "requires manager authorization for %s",
    async (method) => {
      expect((await call(method, {}, "")).status).toBe(401)
      expect((await call(method, {}, player)).status).toBe(401)
    },
  )
  it("rejects player asset uploads", async () => {
    expect((await upload(new File([PNG], "logo.png"), player)).status).toBe(401)
  })
  it("persists legacy-compatible settings and screen backgrounds atomically", async () => {
    const { revision } = await current()
    const theme = {
      appName: "Training",
      colors: { primary: "#123456" },
      logo: "/branding/logo.svg",
      backgrounds: {
        home: "https://example.com/home.png",
        lobby: "/branding/room.png",
        game: "/media/question.png",
        results: "/branding/podium.png",
      },
      font: { family: "Arial" },
    }
    expect((await call("PUT", { theme, revision })).status).toBe(200)
    expect((await current()).theme).toEqual(theme)
    expect(
      JSON.parse(fs.readFileSync(getPath("branding/theme.json"), "utf8")),
    ).toEqual(theme)
    expect(fs.readdirSync(getPath("branding"))).toEqual(["theme.json"])
    expect(fs.readFileSync(getPath("sentinel.txt"), "utf8")).toBe("keep")
  })
  it("preserves file-based font and color-token configuration when saved", async () => {
    const dir = getPath("branding")
    fs.mkdirSync(dir)
    const theme = {
      font: {
        family: "Courier New",
        url: "https://fonts.googleapis.com/css2?family=Rubik",
      },
      colors: {
        primary: "#123456",
        muted: "var(--color-gray-100)",
        "answer-1": "#fff",
      },
    }
    fs.writeFileSync(join(dir, "theme.json"), JSON.stringify(theme))
    const snapshot = await current()
    expect(
      (
        await call("PUT", {
          theme: snapshot.theme,
          revision: snapshot.revision,
        })
      ).status,
    ).toBe(200)
    expect((await current()).theme).toEqual(theme)
  })
  it("rejects stale saves and resets without overwriting another session", async () => {
    const { revision } = await current()
    await call("PUT", { theme: { appName: "First" }, revision })
    expect(
      (await call("PUT", { theme: { appName: "Stale" }, revision })).status,
    ).toBe(409)
    expect((await call("DELETE", { revision })).status).toBe(409)
    expect((await current()).theme).toEqual({ appName: "First" })
  })
  it.each([
    // oxlint-disable-next-line no-script-url -- Deliberately malicious input must be rejected.
    "javascript:alert(1)",
    "data:image/svg+xml,test",
    "http://example.com/a.png",
    "//example.com/a.png",
    "/branding/../theme.json",
    "https://name:secret@example.com/a.png",
  ])("rejects unsafe asset reference %s", async (logo) => {
    const { revision } = await current()
    expect((await call("PUT", { revision, theme: { logo } })).status).toBe(400)
    expect((await current()).revision).toBe(revision)
  })
  it.each([
    { colors: { primary: "red;display:none" } },
    { arbitraryFile: "/etc/passwd" },
    { appName: " " },
  ])("rejects invalid theme %j", async (theme) => {
    const { revision } = await current()
    expect((await call("PUT", { theme, revision })).status).toBe(400)
  })
  it("rejects malformed JSON", async () => {
    expect(
      (
        await app.request("/api/branding", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${manager}`,
            "Content-Type": "application/json",
          },
          body: "{",
        })
      ).status,
    ).toBe(400)
  })
  it("uses detected asset content, ignores supplied paths and keeps files on reset", async () => {
    const response = await upload(
      new File([PNG], "../../logo.svg", { type: "image/svg+xml" }),
    )
    expect(response.status).toBe(201)
    const { url } = (await response.json()) as { url: string }
    expect(url).toMatch(/^\/branding\/asset-[a-f\d-]+\.png$/u)
    const { revision } = await current()
    await call("PUT", { revision, theme: { logo: url } })
    expect(
      (await call("DELETE", { revision: (await current()).revision })).status,
    ).toBe(204)
    expect((await current()).theme).toEqual({})
    expect(fs.existsSync(getPath(url.replace("/branding/", "branding/")))).toBe(
      true,
    )
    expect(fs.readFileSync(getPath("sentinel.txt"), "utf8")).toBe("keep")
  })
  it("rejects executable SVG, empty and oversized uploads", async () => {
    expect(
      (await upload(new File(['<svg onload="alert(1)"></svg>'], "logo.svg")))
        .status,
    ).toBe(415)
    expect((await upload(new File([], "empty.png"))).status).toBe(400)
    expect(
      (
        await upload(
          new File([new Uint8Array(BRANDING_ASSET_MAX_SIZE + 1)], "huge.png"),
        )
      ).status,
    ).toBe(400)
  })
  it("does not follow branding directory symlinks", async () => {
    const outside = getPath("outside")
    fs.mkdirSync(outside)
    fs.symlinkSync(outside, getPath("branding"), "dir")
    expect((await call()).status).toBe(500)
    expect(fs.readdirSync(outside)).toEqual([])
  })
  it("does not follow theme symlinks", async () => {
    fs.mkdirSync(getPath("branding"))
    fs.writeFileSync(getPath("outside.json"), '{"appName":"outside"}')
    fs.symlinkSync(
      getPath("outside.json"),
      join(getPath("branding"), "theme.json"),
    )
    expect((await call()).status).toBe(500)
    expect(fs.readFileSync(getPath("outside.json"), "utf8")).toBe(
      '{"appName":"outside"}',
    )
  })
})
