import type { Avatar } from "@razzia/common/avatar"
import { seedQuizz } from "@razzia/e2e/utils/editor"
import { expect, test } from "@razzia/e2e/utils/fixtures"
import { t } from "@razzia/e2e/utils/i18n"
import { createGame, startGame, next } from "@razzia/e2e/utils/manager"
import { answer } from "@razzia/e2e/utils/player"

test("creates a mobile avatar and retains it through reload, ranking and final report", async ({
  page: manager,
  newPage,
}) => {
  const subject = `Avatar class ${Date.now()}`
  seedQuizz(subject, {
    questions: [
      {
        type: "single",
        question: "Pick yes",
        answers: ["Yes", "No"],
        solutions: [0],
        cooldown: 3,
        time: -1,
      },
      {
        type: "single",
        question: "Pick yes again",
        answers: ["Yes", "No"],
        solutions: [0],
        cooldown: 3,
        time: -1,
      },
    ],
  })
  const pin = await createGame(manager, subject)
  await manager.getByRole("button", { name: t("game:settings.title") }).click()
  const settings = manager.getByRole("dialog")
  await settings.getByRole("switch", { name: t("avatar:enabled") }).click()
  await settings.getByLabel(t("avatar:seconds")).fill("60")
  await settings
    .getByRole("button", { name: t("common:save"), exact: true })
    .click()
  const player = await newPage({
    viewport: { width: 390, height: 720 },
    hasTouch: true,
    isMobile: true,
  })
  await player.goto(`/?pin=${pin}`)
  await player
    .getByPlaceholder(t("game:usernamePlaceholder"))
    .fill("Pixel student")
  await player
    .getByRole("button", { name: t("common:submit"), exact: true })
    .click()
  const editor = player.getByRole("region", { name: t("avatar:title") })
  await expect(editor).toBeVisible()
  await editor
    .getByRole("button", { name: t("avatar:categories.base"), exact: true })
    .click()
  await editor
    .getByLabel(t("avatar:fields.ears"), { exact: true })
    .selectOption("large")
  await editor
    .getByRole("button", { name: t("avatar:categories.eyes"), exact: true })
    .click()
  await editor
    .getByLabel(t("avatar:fields.eyes"), { exact: true })
    .selectOption("hearts")
  await editor
    .getByRole("button", {
      name: t("avatar:categories.accessories"),
      exact: true,
    })
    .click()
  const hats = editor.getByLabel(t("avatar:fields.hat"), { exact: true })
  await hats.selectOption("pilot")
  await editor
    .getByLabel(t("avatar:fields.neck"), { exact: true })
    .selectOption("gold")
  await editor
    .getByLabel(t("avatar:fields.earrings"), { exact: true })
    .selectOption("hoops")
  await player.screenshot({
    path: "test-results/avatar-editor-mobile.png",
    fullPage: true,
  })
  await player.reload()
  await expect(
    player.getByRole("region", { name: t("avatar:title") }),
  ).toBeVisible()
  await player
    .getByRole("button", { name: t("avatar:confirm"), exact: true })
    .click()
  await expect(
    manager.getByText("Pixel student", { exact: true }),
  ).toBeVisible()
  await expect(
    manager.getByRole("img", { name: "Avatar", exact: true }),
  ).toHaveCount(1)
  await player.reload()
  await expect(player.getByText(t("game:waitingForPlayers"))).toBeVisible()
  await expect(
    player.getByRole("img", { name: "Avatar", exact: true }),
  ).toHaveCount(1)
  await startGame(manager)
  await answer(player, "Yes")
  await next(manager)
  await expect(
    manager.getByText(t("game:leaderboard"), { exact: true }),
  ).toBeVisible()
  await expect(
    manager.getByRole("img", { name: "Avatar", exact: true }),
  ).toHaveCount(1)
  await next(manager)
  await answer(player, "Yes")
  await next(manager)
  await expect(manager.getByText(subject, { exact: true })).toBeVisible()
  const saved = await manager.evaluate(async () => {
    const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` }
    const data = (await (await fetch("/api/results", { headers })).json()) as {
      results: Array<{ id: string }>
    }

    return Promise.all(
      data.results.map(
        async (r: { id: string }) =>
          (await fetch(`/api/results/${r.id}`, { headers })).json() as Promise<{
            subject: string
            players: Array<{ avatar: Avatar }>
          }>,
      ),
    )
  })
  const report = saved.find((r) => r.subject === subject)
  expect(report?.players[0].avatar).toMatchObject({
    hat: "pilot",
    eyes: "hearts",
    ears: "large",
    neck: "gold",
    earrings: "hoops",
  })
})

test("automatically enters with a random avatar when the creation deadline expires", async ({
  page: manager,
  newPage,
}) => {
  const pin = await createGame(manager)
  await manager.getByRole("button", { name: t("game:settings.title") }).click()
  const settings = manager.getByRole("dialog")
  await settings.getByRole("switch", { name: t("avatar:enabled") }).click()
  await settings
    .getByRole("switch", { name: t("game:settings.generatedUsernames.label") })
    .click()
  await settings.getByLabel(t("avatar:seconds")).fill("10")
  await settings
    .getByRole("button", { name: t("common:save"), exact: true })
    .click()
  const player = await newPage()
  await player.goto(`/?pin=${pin}`)
  await player
    .getByRole("button", { name: t("common:submit"), exact: true })
    .click()
  await expect(
    player.getByRole("region", { name: t("avatar:title") }),
  ).toBeVisible()
  await expect(player.getByText(t("game:waitingForPlayers"))).toBeVisible()
  await expect(
    player.getByRole("region", { name: t("avatar:title") }),
  ).toHaveCount(0)
  await expect(
    manager.getByRole("img", { name: "Avatar", exact: true }),
  ).toHaveCount(1)
})
