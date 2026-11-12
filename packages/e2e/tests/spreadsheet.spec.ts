import fs from "fs"
import {
  openQuizzTab,
  quizzRow,
  seedQuizz,
  readQuizz,
} from "@razzia/e2e/utils/editor"
import { expect, test } from "@razzia/e2e/utils/fixtures"
import { t } from "@razzia/e2e/utils/i18n"

test("exports a quiz and imports it only after review", async ({ page }) => {
  const subject = `Spreadsheet ${Date.now()}`
  seedQuizz(subject)
  await openQuizzTab(page)
  await quizzRow(page, subject)
    .getByTitle(t("manager:spreadsheet.export"))
    .click()
  const review = page.getByRole("region", {
    name: t("manager:spreadsheet.review"),
  })
  await expect(review).toBeVisible()
  const download = page.waitForEvent("download")
  await review
    .getByRole("button", { name: t("manager:spreadsheet.confirm") })
    .click()
  const file = await download
  const path = await file.path()
  expect(path).toBeTruthy()
  const name = `Imported ${Date.now()}`
  await page
    .getByLabel(t("manager:spreadsheet.import"), { exact: true })
    .setInputFiles({
      name: `${name}.xlsx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: fs.readFileSync(path),
    })
  await expect(review).toBeVisible()
  expect(readQuizz(name)).toBeUndefined()
  await review
    .getByRole("button", { name: t("manager:spreadsheet.confirm") })
    .click()
  await expect(page.getByText(t("quizz:quizzSaved"))).toBeVisible()
  expect(readQuizz(name)?.questions[0].answers).toEqual(["Yes", "No"])
})

test("blocks unsupported export without a download", async ({ page }) => {
  const subject = `Unsupported ${Date.now()}`
  seedQuizz(subject, { gameMode: "survey" })
  await openQuizzTab(page)
  await quizzRow(page, subject)
    .getByTitle(t("manager:spreadsheet.export"))
    .click()
  const review = page.getByRole("region", {
    name: t("manager:spreadsheet.review"),
  })
  await expect(
    review.getByText(t("manager:spreadsheet.issues.mode"), { exact: false }),
  ).toBeVisible()
  await expect(
    review.getByRole("button", { name: t("manager:spreadsheet.confirm") }),
  ).toHaveCount(0)
})

for (const width of [390, 1280]) {
  test(`keeps quiz creation and Kahoot import on one row at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await openQuizzTab(page)
    const create = page.getByRole("button", {
      name: t("manager:quizz.create"),
      exact: true,
    })
    const importKahoot = page.getByTitle(t("manager:spreadsheet.import"), {
      exact: true,
    })
    await expect(create).toBeVisible()
    await expect(importKahoot).toBeVisible()
    const createBox = await create.boundingBox()
    const importBox = await importKahoot.boundingBox()
    expect(createBox).not.toBeNull()
    expect(importBox).not.toBeNull()

    if (!createBox || !importBox) {
      throw new Error("Quiz actions have no visible bounds")
    }

    expect(Math.abs(createBox.y - importBox.y)).toBeLessThan(2)
    expect(createBox.x + createBox.width).toBeLessThan(importBox.x)
    expect(importBox.x + importBox.width).toBeLessThanOrEqual(width)
    await page.screenshot({ path: `test-results/quiz-actions-${width}.png` })
  })
}
