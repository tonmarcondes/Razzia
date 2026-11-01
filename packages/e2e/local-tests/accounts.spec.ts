import { test, expect, type Page } from "@playwright/test"
import { t } from "@razzia/e2e/utils/i18n"
import { joinGame, answer } from "@razzia/e2e/utils/player"

const TEMP = "Temporary administrator test 20!"
const ADMIN = "Personal administrator test 21!"
const TEACHER_TEMP = "Temporary teacher test password 22!"
const TEACHER = "Personal teacher test password 23!"
const tr = (key: string) => t(key, { lng: "pt" })
const login = async (page: Page, name: string, password: string) => {
  await page.goto("/manager")
  await page
    .getByLabel(tr("manager:accounts.login"), { exact: true })
    .fill(name)
  await page
    .getByPlaceholder(tr("manager:passwordPlaceholder"), { exact: true })
    .fill(password)
  await page
    .getByRole("button", { name: tr("common:submit"), exact: true })
    .click()
  await expect(page).toHaveURL(/\/manager\/config$/u)
}
const change = async (page: Page, current: string, password: string) => {
  await page
    .getByLabel(tr("manager:accounts.currentPassword"), { exact: true })
    .fill(current)
  await page
    .getByLabel(tr("manager:accounts.newPassword"), { exact: true })
    .fill(password)
  await page
    .getByLabel(tr("manager:accounts.confirmPassword"), { exact: true })
    .fill(password)
  await page
    .getByRole("button", {
      name: tr("manager:accounts.changePassword"),
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(/\/manager\/?$/u)
}
const api = (
  page: Page,
  route: string,
  options: { method?: string; body?: unknown } = {},
) =>
  page.evaluate(
    async ({ route: requestRoute, options: requestOptions }) => {
      const r = await fetch(`/api/${requestRoute}`, {
        method: requestOptions.method ?? "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        ...(requestOptions.body
          ? { body: JSON.stringify(requestOptions.body) }
          : {}),
      })

      return {
        status: r.status,
        body:
          r.status === 204
            ? null
            : ((await r.json()) as Record<string, unknown>),
      }
    },
    { route, options },
  )

test("administers teachers, isolates two simultaneous classes and revokes a live host", async ({
  page: admin,
  browser,
  baseURL,
}, testInfo) => {
  await login(admin, "admin", TEMP)
  await expect(admin.getByRole("alert")).toContainText(
    tr("manager:accounts.changeRequired"),
  )
  await expect(
    admin.getByRole("button", { name: tr("manager:tabs.quizz"), exact: true }),
  ).toHaveCount(0)
  await change(admin, TEMP, ADMIN)
  await login(admin, "admin", ADMIN)
  await admin
    .getByRole("button", { name: tr("manager:tabs.accounts"), exact: true })
    .click()
  const create = async (name: string, displayName: string) => {
    await admin
      .getByRole("region", { name: tr("manager:accounts.users") })
      .getByLabel(tr("manager:accounts.login"), { exact: true })
      .fill(name)
    await admin
      .getByRole("region", { name: tr("manager:accounts.users") })
      .getByLabel(tr("manager:accounts.name"), { exact: true })
      .fill(displayName)
    await admin
      .getByRole("region", { name: tr("manager:accounts.users") })
      .getByLabel(tr("manager:accounts.temporaryPassword"), { exact: true })
      .fill(TEACHER_TEMP)
    await admin
      .getByRole("region", { name: tr("manager:accounts.users") })
      .getByRole("button", { name: tr("manager:accounts.create"), exact: true })
      .click()
    await expect(
      admin.getByText(`${displayName} (${name})`, { exact: false }),
    ).toBeVisible()
  }
  await create("teacher-a", "Professor A")
  await create("teacher-b", "Professor B")
  const administration = admin.getByRole("region", {
    name: tr("manager:accounts.users"),
  })
  await administration
    .getByRole("listitem")
    .filter({ hasText: "teacher-b" })
    .getByRole("button", { name: tr("manager:accounts.edit"), exact: true })
    .click()
  await administration
    .getByLabel(tr("manager:accounts.name"), { exact: true })
    .fill("Professor B atualizado")
  await administration
    .getByRole("button", { name: tr("common:save"), exact: true })
    .click()
  await expect(
    administration.getByText("Professor B atualizado (teacher-b)", {
      exact: false,
    }),
  ).toBeVisible()
  const a = await browser.newContext({ baseURL, locale: "pt-BR" }),
    b = await browser.newContext({ baseURL, locale: "pt-BR" })
  const pa = await browser.newContext({ baseURL, locale: "en-US" }),
    pb = await browser.newContext({ baseURL, locale: "en-US" })

  try {
    const hostA = await a.newPage(),
      hostB = await b.newPage(),
      playerA = await pa.newPage(),
      playerB = await pb.newPage()
    await login(hostA, "teacher-a", TEACHER_TEMP)
    await change(hostA, TEACHER_TEMP, TEACHER)
    await login(hostA, "teacher-a", TEACHER)
    await hostA
      .getByRole("button", { name: tr("manager:tabs.accounts"), exact: true })
      .click()
    const profile = hostA.getByRole("region", {
      name: tr("manager:accounts.profile"),
    })
    await profile
      .getByLabel(tr("manager:accounts.login"), { exact: true })
      .fill("teacher-a-updated")
    await profile
      .getByLabel(tr("manager:accounts.name"), { exact: true })
      .fill("Professor A atualizado")
    await profile
      .getByLabel(tr("manager:accounts.profilePassword"), { exact: true })
      .fill(TEACHER)
    await profile
      .getByRole("button", {
        name: tr("manager:accounts.saveProfile"),
        exact: true,
      })
      .click()
    await expect(
      profile.getByLabel(tr("manager:accounts.login"), { exact: true }),
    ).toHaveValue("teacher-a-updated")
    await expect(
      hostA.getByRole("heading", { name: tr("manager:accounts.users") }),
    ).toHaveCount(0)
    expect(
      (
        await api(hostA, "auth/profile", {
          method: "PATCH",
          body: {
            login: "teacher-a",
            displayName: "Professor A",
            currentPassword: TEACHER,
          },
        })
      ).status,
    ).toBe(200)
    await hostA.goto("/manager/config")
    await login(hostB, "teacher-b", TEACHER_TEMP)
    await change(hostB, TEACHER_TEMP, TEACHER)
    await login(hostB, "teacher-b", TEACHER)
    await expect(
      hostA.getByRole("button", {
        name: tr("manager:tabs.appearance"),
        exact: true,
      }),
    ).toHaveCount(0)
    const createQuiz = async (page: Page, subject: string) => {
      const result = await api(page, "quizz", {
        method: "POST",
        body: {
          gameMode: "quiz",
          subject,
          questions: [
            {
              type: "single",
              question: subject,
              answers: ["Correct", "Wrong"],
              solutions: [0],
              cooldown: 3,
              time: 60,
            },
          ],
        },
      })
      expect(result.status).toBe(201)

      return String(result.body?.id)
    }
    const qa = await createQuiz(hostA, "Class A"),
      qb = await createQuiz(hostB, "Class B")
    expect((await api(hostB, `quizz/${qa}`)).status).toBe(404)
    expect((await api(hostA, `quizz/${qb}`)).status).toBe(404)
    await hostA
      .getByRole("button", { name: tr("manager:tabs.quizz"), exact: true })
      .click()
    const owned = hostA.getByText("Class A", { exact: true }).locator("..")
    await owned
      .getByRole("combobox", {
        name: t("manager:library.visibilityFor", {
          lng: "pt",
          name: "Class A",
        }),
      })
      .selectOption("public")
    await hostB.goto("/manager/config")
    await hostB
      .getByRole("button", { name: tr("manager:tabs.quizz"), exact: true })
      .click()
    const shared = hostB.getByText("Class A", { exact: true }).locator("..")
    await expect(shared.getByText(tr("manager:library.readOnly"))).toBeVisible()
    await expect(
      shared.getByRole("button", {
        name: tr("manager:quizz.edit"),
        exact: true,
      }),
    ).toHaveCount(0)
    await expect(
      shared.getByRole("button", {
        name: tr("manager:quizz.delete"),
        exact: true,
      }),
    ).toHaveCount(0)
    expect((await api(hostB, `quizz/${qa}`)).status).toBe(200)
    expect(
      (
        await api(hostB, `quizz/${qa}/visibility`, {
          method: "PATCH",
          body: { visibility: "private" },
        })
      ).status,
    ).toBe(404)
    await hostB.setViewportSize({ width: 390, height: 844 })
    expect(
      await hostB.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await hostB.screenshot({
      path: testInfo.outputPath("public-library-mobile.png"),
      fullPage: true,
    })
    await hostB.setViewportSize({ width: 1280, height: 720 })
    await owned.getByRole("combobox").selectOption("private")
    await expect
      .poll(async () => (await api(hostB, `quizz/${qa}`)).status)
      .toBe(404)
    await hostA.goto("/manager/config")
    await hostB.goto("/manager/config")
    await hostA.reload()
    await hostB.reload()
    await hostA.getByRole("button", { name: "Class A", exact: true }).click()
    await hostA
      .getByRole("button", { name: tr("manager:quizz.startGame"), exact: true })
      .click()
    await hostB.getByRole("button", { name: "Class B", exact: true }).click()
    await hostB
      .getByRole("button", { name: tr("manager:quizz.startGame"), exact: true })
      .click()
    const pinA = await hostA.getByText(/^\d{6}$/u).textContent(),
      pinB = await hostB.getByText(/^\d{6}$/u).textContent()
    expect(pinA).not.toBe(pinB)
    const gameA = hostA.url().split("/").at(-1) ?? ""
    expect(
      (
        await api(hostB, `games/${gameA}/settings`, {
          method: "PATCH",
          body: { answersOnly: true },
        })
      ).status,
    ).toBe(404)
    await joinGame(playerA, pinA ?? "", "Participant A")
    await joinGame(playerB, pinB ?? "", "Participant B")
    await expect(
      hostA.getByText("Participant A", { exact: true }),
    ).toBeVisible()
    await expect(
      hostB.getByText("Participant B", { exact: true }),
    ).toBeVisible()
    await hostA
      .getByRole("button", { name: tr("game:startGame"), exact: true })
      .click()
    await hostB
      .getByRole("button", { name: tr("game:startGame"), exact: true })
      .click()
    await expect(playerA.getByText("Class A", { exact: true })).toBeVisible()
    await expect(playerB.getByText("Class B", { exact: true })).toBeVisible()
    await answer(playerA, "Correct")
    await answer(playerB, "Wrong")
    await hostA
      .getByRole("button", { name: tr("common:next"), exact: true })
      .click()
    await hostB
      .getByRole("button", { name: tr("common:next"), exact: true })
      .click()
    await expect(
      hostA.getByRole("button", { name: tr("common:exit"), exact: true }),
    ).toBeVisible()
    await expect(
      hostB.getByRole("button", { name: tr("common:exit"), exact: true }),
    ).toBeVisible()
    const reportsA = await api(hostA, "results"),
      reportsB = await api(hostB, "results")
    expect(reportsA.body?.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ subject: "Class A" })]),
    )
    expect(reportsB.body?.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ subject: "Class B" })]),
    )
    expect(JSON.stringify(reportsA.body)).not.toContain("Class B")
    expect(JSON.stringify(reportsB.body)).not.toContain("Class A")
    await hostB
      .getByRole("button", { name: tr("common:exit"), exact: true })
      .click()
    await hostB.getByRole("button", { name: "Class B", exact: true }).click()
    await hostB
      .getByRole("button", { name: tr("manager:quizz.startGame"), exact: true })
      .click()
    const activePin = await hostB.getByText(/^\d{6}$/u).textContent()
    await joinGame(playerB, activePin ?? "", "Participant B2")
    await expect(
      hostB.getByText("Participant B2", { exact: true }),
    ).toBeVisible()
    await hostB
      .getByRole("button", { name: tr("game:startGame"), exact: true })
      .click()
    await expect(
      hostB.getByRole("button", { name: tr("common:skip"), exact: true }),
    ).toBeVisible()
    const users = await api(admin, "users")
    const teacher = (
      (users.body?.users ?? []) as Array<{ id: string; login: string }>
    ).find((user) => user.login === "teacher-b")
    const disabled = await api(admin, `users/${teacher?.id}`, {
      method: "PATCH",
      body: { displayName: "Professor B", role: "teacher", active: false },
    })
    expect(disabled.status).toBe(200)
    expect((await api(hostB, "quizz")).status).toBe(401)
    expect((await api(hostA, "quizz")).status).toBe(200)
    await admin.screenshot({
      path: testInfo.outputPath("accounts-desktop.png"),
      fullPage: true,
    })
    await admin.setViewportSize({ width: 390, height: 844 })
    expect(
      await admin.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await admin.screenshot({
      path: testInfo.outputPath("accounts-mobile.png"),
      fullPage: true,
    })
  } finally {
    await Promise.all([a.close(), b.close(), pa.close(), pb.close()])
  }
})
