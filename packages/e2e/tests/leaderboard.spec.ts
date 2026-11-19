import type { Locator, Page } from "@playwright/test"
import { seedQuizz } from "@razzia/e2e/utils/editor"
import { expect, test } from "@razzia/e2e/utils/fixtures"
import { t } from "@razzia/e2e/utils/i18n"
import { createGame, startGame, next } from "@razzia/e2e/utils/manager"
import { answer, joinGame } from "@razzia/e2e/utils/player"

const sequential = <T>(
  items: T[],
  run: (item: T) => Promise<void>,
): Promise<void> =>
  items.reduce(
    (previous, item) => previous.then(() => run(item)),
    Promise.resolve(),
  )

const rowsVisible = (nodes: Array<HTMLElement | SVGElement>) =>
  nodes.every(
    (node, i) =>
      getComputedStyle(node).opacity === "1" &&
      (i === 0 ||
        node.getBoundingClientRect().top >=
          nodes[i - 1].getBoundingClientRect().bottom),
  )

const checkViewport = async (
  manager: Page,
  ranking: Locator,
  {
    viewport,
    label,
  }: { viewport: { width: number; height: number }; label: string },
) => {
  await manager.setViewportSize(viewport)
  await expect
    .poll(() =>
      manager.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
  const scores = ranking.getByText(/^\d{1,5}$/u)
  await expect(scores).toHaveCount(5)
  await expect
    .poll(() => ranking.getByRole("listitem").evaluateAll(rowsVisible))
    .toBe(true)
  await sequential([0, 1, 2, 3, 4], async (i) => {
    await scores.nth(i).scrollIntoViewIfNeeded()
    await expect(scores.nth(i)).toBeInViewport()
    const box = await scores.nth(i).boundingBox()
    expect(box?.x).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      viewport.width,
    )
  })
  await manager.screenshot({
    path: `test-results/ranking-${label}-${viewport.width}.png`,
    fullPage: true,
  })
}

for (const avatars of [false, true]) {
  test(`keeps intermediate rankings readable across rounds, reconnects and viewport sizes (avatars: ${avatars})`, async ({
    page: manager,
    newPage,
  }) => {
    const subject = `Ranking regression ${Date.now()}`
    seedQuizz(subject, {
      questions: Array.from({ length: 4 }, (_, i) => ({
        type: "single",
        question: `Round ${i + 1}`,
        answers: ["Yes", "No"],
        solutions: [0],
        cooldown: 3,
        time: -1,
      })),
    })
    const pin = await createGame(manager, subject)

    if (avatars) {
      await manager
        .getByRole("button", { name: t("game:settings.title") })
        .click()
      const settings = manager.getByRole("dialog")
      await settings.getByRole("switch", { name: t("avatar:enabled") }).click()
      await settings.getByLabel(t("avatar:seconds")).fill("180")
      await settings
        .getByRole("button", { name: t("common:save"), exact: true })
        .click()
    }

    const names = [
      "WWWWWWWWWWWWWWWWWWWW",
      "Maria Treinamento",
      "João Técnico",
      "Carla Supervisora",
      "Renato Instrutor",
      "Ana",
    ]
    const players = await Promise.all(names.map(() => newPage()))
    await Promise.all(
      players.map(async (p, i) => {
        if (!avatars) {
          await joinGame(p, pin, names[i])

          return
        }

        await p.goto(`/?pin=${pin}`)
        await p.getByPlaceholder(t("game:usernamePlaceholder")).fill(names[i])
        await p
          .getByRole("button", { name: t("common:submit"), exact: true })
          .click()
        await p
          .getByRole("button", { name: t("avatar:confirm"), exact: true })
          .click()
        await expect(p.getByText(t("game:waitingForPlayers"))).toBeVisible()
      }),
    )
    await startGame(manager)
    await sequential([0, 1, 2], async (round) => {
      await Promise.all(
        players.map((p, i) => answer(p, i === round ? "No" : "Yes")),
      )
      await next(manager)
      await expect(
        manager.getByText(t("game:leaderboard"), { exact: true }),
      ).toBeVisible()

      if (round === 0) {
        await expect(
          manager
            .getByRole("heading", { name: t("game:leaderboard"), exact: true })
            .locator("..")
            .getByText(names[0], { exact: true }),
        ).toHaveCount(0, { timeout: 1000 })
      }

      const ranking = manager.getByRole("region", {
        name: t("game:leaderboard"),
        exact: true,
      })
      const rows = ranking.getByRole("listitem")
      await expect(rows).toHaveCount(5, { timeout: 1000 })

      if (round === 0) {
        await expect(ranking.getByText(names[0], { exact: true })).toHaveCount(
          0,
          { timeout: 1000 },
        )
      }

      await sequential(
        [
          { width: 1280, height: 720 },
          { width: 390, height: 720 },
          { width: 720, height: 390 },
        ],
        (viewport) =>
          checkViewport(manager, ranking, {
            viewport,
            label: `${avatars}-${round}`,
          }),
      )
      await manager.setViewportSize({ width: 1280, height: 720 })
      await manager.reload()
      await expect(rows).toHaveCount(5)
      await expect(ranking.getByText(/^\d{1,5}$/u)).toHaveCount(5)
      await next(manager)
    })
  })
}
