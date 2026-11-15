import type { Avatar } from "@razzia/common/avatar"
import { seedQuizz } from "@razzia/e2e/utils/editor"
import { expect, test } from "@razzia/e2e/utils/fixtures"
import { t } from "@razzia/e2e/utils/i18n"
import { createGame, startGame, next } from "@razzia/e2e/utils/manager"
import { answer } from "@razzia/e2e/utils/player"

const avatarLabelsRevealed = (nodes: Array<HTMLElement | SVGElement>) =>
  nodes.every(
    (node) =>
      node.parentElement &&
      getComputedStyle(node.parentElement).opacity === "1",
  )

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

test("renders distinct new accessories for six simultaneous players and preserves them in results", async ({
  page: manager,
  newPage,
}) => {
  const playerText = (key: string) => t(key, { lng: "pt" })
  const subject = `Avatar gallery ${Date.now()}`
  seedQuizz(subject, {
    questions: [
      {
        type: "single",
        question: "Choose yes",
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
  await settings.getByLabel(t("avatar:seconds")).fill("180")
  await settings
    .getByRole("button", { name: t("common:save"), exact: true })
    .click()
  const variants = [
    { mouth: "pacifier", hand: "bottle", skin: "deep", hat: "none" },
    { mouth: "zipper", hand: "none", skin: "light", hat: "pilot" },
    { mouth: "smile", hand: "bottle", skin: "tan", hat: "chef" },
    { mouth: "pacifier", hand: "coffee", skin: "sky", hat: "santa" },
    { mouth: "zipper", hand: "bottle", skin: "medium", hat: "panamaBlack" },
    { mouth: "smile", hand: "plane", skin: "golden", hat: "hardHat" },
  ] as const
  const players = await Promise.all(
    variants.map(() =>
      newPage({
        viewport: { width: 390, height: 720 },
        locale: "pt-BR",
        isMobile: true,
        hasTouch: true,
      }),
    ),
  )
  await Promise.all(
    players.map(async (player, i) => {
      await player.goto(`/?pin=${pin}`)
      await player
        .getByPlaceholder(playerText("game:usernamePlaceholder"))
        .fill(`Gallery ${i + 1}`)
      await player
        .getByRole("button", { name: playerText("common:submit"), exact: true })
        .click()
      const editor = player.getByRole("region", {
        name: playerText("avatar:title"),
      })
      await editor
        .getByLabel(playerText("avatar:fields.nose"), { exact: true })
        .selectOption("large")
      await editor
        .getByLabel(playerText("avatar:fields.skin"), { exact: true })
        .selectOption(variants[i].skin)
      await expect(
        editor.getByRole("option", { name: "Negro", exact: true }),
      ).toHaveCount(1)
      await editor
        .getByRole("button", {
          name: playerText("avatar:categories.mouth"),
          exact: true,
        })
        .click()
      await editor
        .getByLabel(playerText("avatar:fields.mouth"), { exact: true })
        .selectOption(variants[i].mouth)
      await editor
        .getByRole("button", {
          name: playerText("avatar:categories.accessories"),
          exact: true,
        })
        .click()
      await editor
        .getByLabel(playerText("avatar:fields.hat"), { exact: true })
        .selectOption(variants[i].hat)
      await editor
        .getByLabel(playerText("avatar:fields.hand"), { exact: true })
        .selectOption(variants[i].hand)
      await player.screenshot({
        path: `test-results/avatar-options-${i + 1}.png`,
        fullPage: true,
      })
      await editor
        .getByRole("button", {
          name: playerText("avatar:confirm"),
          exact: true,
        })
        .click()
      await expect(
        player.getByText(playerText("game:waitingForPlayers")),
      ).toBeVisible()
    }),
  )
  const avatars = manager.getByRole("img", { name: "Avatar", exact: true })
  await expect(avatars).toHaveCount(6)
  await Promise.all(
    players.map(async (_player, i) => {
      await expect(
        manager.getByText(`Gallery ${i + 1}`, { exact: true }),
      ).toBeVisible()
      await expect(avatars.nth(i)).toBeVisible()
    }),
  )
  await manager.screenshot({
    path: "test-results/avatar-six-player-lobby.png",
    fullPage: true,
  })
  await manager.setViewportSize({ width: 390, height: 720 })
  await expect(avatars).toHaveCount(6)
  await expect
    .poll(() =>
      manager.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
  await avatars.last().scrollIntoViewIfNeeded()
  await expect(avatars.last()).toBeInViewport()
  await manager.screenshot({
    path: "test-results/avatar-six-player-mobile.png",
    fullPage: true,
  })
  await manager.setViewportSize({ width: 1280, height: 720 })
  await startGame(manager)
  await Promise.all(players.map((p) => answer(p, "Yes")))
  await next(manager)
  await expect(manager.getByText(subject, { exact: true })).toBeVisible()
  await expect(avatars).toHaveCount(3)
  await expect.poll(() => avatars.evaluateAll(avatarLabelsRevealed)).toBe(true)
  await Promise.all(
    [0, 1, 2].map((i) => expect(avatars.nth(i)).toBeInViewport()),
  )
  const scores = manager.getByText(/^\d{3,4}$/u)
  await expect(scores).toHaveCount(3)
  await Promise.all(
    [0, 1, 2].map((i) => expect(scores.nth(i)).toBeInViewport()),
  )
  await manager.screenshot({
    path: "test-results/avatar-six-player-podium.png",
    fullPage: true,
  })
  await manager.setViewportSize({ width: 390, height: 720 })
  await expect
    .poll(() =>
      manager.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
  await scores.last().scrollIntoViewIfNeeded()
  await expect(scores.last()).toBeInViewport()
  await manager.screenshot({
    path: "test-results/avatar-six-player-podium-mobile.png",
    fullPage: true,
  })
  await manager.setViewportSize({ width: 720, height: 390 })
  await scores.last().scrollIntoViewIfNeeded()
  await expect(scores.last()).toBeInViewport()
  await manager.screenshot({
    path: "test-results/avatar-six-player-podium-landscape.png",
    fullPage: true,
  })
  const reports = await manager.evaluate(async () => {
    const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` }
    const data = (await (await fetch("/api/results", { headers })).json()) as {
      results: Array<{ id: string }>
    }

    return Promise.all(
      data.results.map(
        async (r) =>
          (await fetch(`/api/results/${r.id}`, { headers })).json() as Promise<{
            subject: string
            players: Array<{ username: string; avatar: Avatar }>
          }>,
      ),
    )
  })
  const report = reports.find((r) => r.subject === subject)
  expect(report?.players).toHaveLength(6)
  for (const [i, variant] of variants.entries()) {
    expect(
      report?.players.find((p) => p.username === `Gallery ${i + 1}`)?.avatar,
    ).toMatchObject({ ...variant, nose: "large" })
  }
})
