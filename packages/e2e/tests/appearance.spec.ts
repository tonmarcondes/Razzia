import type { BrandingTheme } from "@razzia/common/validators/branding"
import type { Page } from "@playwright/test"
import { expect, test } from "@razzia/e2e/utils/fixtures"
import { t } from "@razzia/e2e/utils/i18n"
import {
  createGame,
  loginManager,
  next,
  startGame,
} from "@razzia/e2e/utils/manager"
import { answer, joinGame } from "@razzia/e2e/utils/player"
import { CONFIG_PATH } from "@razzia/e2e/utils/constants"
import fs from "fs"
import { basename, join } from "path"

const readSettings = async (page: Page, headers: Record<string, string>) => {
  const response = await page.request.get("/api/branding", { headers })
  expect(response.ok()).toBe(true)

  return (await response.json()) as { theme: BrandingTheme; revision: string }
}

test.describe.configure({ mode: "serial" })
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

test("previews, persists and restores appearance without changing already-open windows", async ({
  page,
  newPage,
}) => {
  await loginManager(page)
  const token = await page.evaluate(() => localStorage.getItem("token"))
  const headers = { Authorization: `Bearer ${token}` }
  const original = await readSettings(page, headers)
  const assets: string[] = []

  try {
    const oldWindow = await newPage()
    await oldWindow.goto("/")
    await expect(oldWindow).toHaveTitle("Razzia")
    await page
      .getByRole("button", { name: t("manager:tabs.appearance"), exact: true })
      .click()
    await page
      .getByLabel(t("manager:appearance.appName"), { exact: true })
      .fill("Training Lab")
    await page
      .getByLabel(
        t("manager:appearance.colorValue", {
          label: t("manager:appearance.color.primary"),
        }),
        { exact: true },
      )
      .fill("#123456")
    await expect(
      page
        .getByRole("region", { name: t("manager:appearance.preview") })
        .getByRole("heading", { name: "Training Lab" }),
    ).toBeVisible()
    expect(
      await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--color-primary"),
      ),
    ).toBe("")
    const uploadStage = async (stage: "home" | "game") => {
      await page
        .getByLabel(
          t("manager:appearance.uploadFor", {
            label: t(`manager:appearance.stage.${stage}`),
          }),
          { exact: true },
        )
        .setInputFiles({
          name: `${stage}.png`,
          mimeType: "image/png",
          buffer: PNG,
        })
      const field = page.getByLabel(t(`manager:appearance.stage.${stage}`), {
        exact: true,
      })
      await expect(field).toHaveValue(/^\/branding\/asset-[a-f\d-]+\.png$/u)
      assets.push(await field.inputValue())
    }
    await uploadStage("home")
    await uploadStage("game")
    await page
      .getByLabel(t("manager:appearance.logo"), { exact: true })
      .fill(assets[0])
    await page
      .getByLabel(t("manager:appearance.favicon"), { exact: true })
      .fill(assets[0])
    await page
      .getByLabel(t("manager:appearance.stage.lobby"), { exact: true })
      .fill(assets[0])
    await page
      .getByLabel(t("manager:appearance.stage.results"), { exact: true })
      .fill(assets[0])
    await page
      .getByRole("button", { name: t("manager:appearance.save"), exact: true })
      .click()
    await expect(page).toHaveTitle("Training Lab")
    await expect(
      page.getByLabel(t("manager:appearance.appName"), { exact: true }),
    ).toHaveValue("Training Lab")
    await expect(oldWindow).toHaveTitle("Razzia")
    await page.reload()
    await expect(
      page.getByLabel(t("manager:appearance.appName"), { exact: true }),
    ).toHaveValue("Training Lab")
    const fresh = await newPage()
    await fresh.goto("/")
    await expect(fresh).toHaveTitle("Training Lab")
    await expect(
      fresh.getByRole("img", { name: "Training Lab" }),
    ).toHaveAttribute("src", assets[0])
    await expect(fresh.locator('img[alt=""]')).toHaveAttribute("src", assets[0])
    expect(
      await fresh.evaluate(() =>
        document
          .querySelector<HTMLLinkElement>("link#favicon")
          ?.getAttribute("href"),
      ),
    ).toBe(assets[0])
    expect(
      await fresh.evaluate(() =>
        document.documentElement.style.getPropertyValue("--color-primary"),
      ),
    ).toBe("#123456")
    const host = await newPage(),
      player = await newPage()
    const pin = await createGame(host)
    await joinGame(player, pin, "Appearance player")
    await expect(
      host.getByRole("img", { name: "background", exact: true }),
    ).toHaveAttribute("src", assets[0])
    await expect(
      host.getByText("Appearance player", { exact: true }),
    ).toBeVisible()
    await startGame(host)
    await expect(
      player.getByRole("button", { name: /^A Paris$/u }),
    ).toBeVisible()
    await expect(
      host.getByRole("img", { name: "background", exact: true }),
    ).toHaveAttribute("src", assets[1])
    await answer(player, "Paris")
    await expect(
      player.getByText(t("game:correct"), { exact: true }),
    ).toBeVisible()
    await next(host)
    await expect(
      host.getByText(t("game:leaderboard"), { exact: true }),
    ).toBeVisible()
    await expect(
      host.getByRole("img", { name: "background", exact: true }),
    ).toHaveAttribute("src", assets[0])
    await next(host)
    await answer(player, "4")
    await expect(
      player.getByText(t("game:correct"), { exact: true }),
    ).toBeVisible()
    await next(host)
    await expect(
      host.getByRole("img", { name: "background", exact: true }),
    ).toHaveAttribute("src", assets[0])
    await host
      .getByRole("button", { name: t("common:exit"), exact: true })
      .click()
    await page.screenshot({
      path: join(import.meta.dirname, "../test-results/appearance-desktop.png"),
      fullPage: true,
    })
    await page
      .getByRole("button", { name: t("manager:appearance.reset"), exact: true })
      .click()
    await page
      .getByRole("button", { name: t("common:confirm"), exact: true })
      .click()
    await expect(page).toHaveTitle("Razzia")
    expect((await readSettings(page, headers)).theme).toEqual({})
    await fresh.reload()
    await expect(fresh).toHaveTitle("Razzia")
    for (const url of assets) {
      expect(fs.existsSync(join(CONFIG_PATH, "branding", basename(url)))).toBe(
        true,
      )
    }
  } finally {
    const current = await readSettings(page, headers)
    await page.request.put("/api/branding", {
      headers,
      data: { theme: original.theme, revision: current.revision },
    })
    for (const url of assets) {
      fs.rmSync(join(CONFIG_PATH, "branding", basename(url)), { force: true })
    }
  }
})

test("keeps a mobile draft and rejects a stale save", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginManager(page)
  const token = await page.evaluate(() => localStorage.getItem("token"))
  const headers = { Authorization: `Bearer ${token}` }
  const original = await readSettings(page, headers)

  try {
    await page
      .getByRole("button", { name: t("manager:tabs.appearance"), exact: true })
      .click()
    await page
      .getByLabel(t("manager:appearance.appName"), { exact: true })
      .fill("My unsaved draft")
    await page.request.put("/api/branding", {
      headers,
      data: {
        theme: { appName: "Another presenter" },
        revision: original.revision,
      },
    })
    await page
      .getByRole("button", { name: t("manager:appearance.save"), exact: true })
      .click()
    await expect(
      page.getByText(t("errors:branding.conflict"), { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByLabel(t("manager:appearance.appName"), { exact: true }),
    ).toHaveValue("My unsaved draft")
    expect((await readSettings(page, headers)).theme.appName).toBe(
      "Another presenter",
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: join(import.meta.dirname, "../test-results/appearance-mobile.png"),
      fullPage: true,
    })
  } finally {
    const current = await readSettings(page, headers)
    await page.request.put("/api/branding", {
      headers,
      data: { theme: original.theme, revision: current.revision },
    })
  }
})
