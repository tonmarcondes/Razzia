import { parseLegacyResult } from "@razzia/socket/storage/legacy-validation"
import { app } from "@razzia/socket/app"
import {
  getAccounts,
  assertAccountModeReady,
  assertLegacyModeReady,
} from "@razzia/socket/services/accounts"
import { localResources } from "@razzia/socket/services/local-resources"
import { getPath } from "@razzia/socket/services/config"
import { mintToken, verifyToken } from "@razzia/socket/services/auth"
import { setIo } from "@razzia/socket/services/io"
import Registry from "@razzia/socket/services/registry"
import { LocalDatabase } from "@razzia/socket/storage/database"
import {
  inspectLegacy,
  migrateLegacy,
} from "@razzia/socket/storage/legacy-migration"
import { activateLocalStore } from "@razzia/socket/storage/activation"
import { allocateInviteCode } from "@razzia/socket/utils/game"
import { createFakeIo } from "@razzia/socket/test/fake-io"
import { createQuestion, createQuizz } from "@razzia/socket/test/fixtures"
import type { GameResult } from "@razzia/common/types/game"
import fs from "node:fs"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("@razzia/socket/env", () => ({
  authMode: "local",
  jwtSecret: "synthetic-isolation-secret-with-32-characters",
  managerPassword: "legacy-secret",
  gameSpeed: 10,
}))
const TEMP = "Temporary isolation test password 15!"
const PASS = "Personal isolation test password 16!"
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)
const fake = createFakeIo()
let admin = "",
  teacherA = "",
  teacherB = "",
  teacherAId = "",
  sourceId = "",
  uploaded = ""
const request = (
  route: string,
  options: { method?: string; body?: unknown; token?: string } = {},
) =>
  app.request(`/api/${route}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${options.token ?? admin}`,
      "Content-Type": "application/json",
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
const login = async (name: string, password: string) => {
  const r = await request("auth/login", {
    method: "POST",
    body: { login: name, password },
  })
  expect(r.status).toBe(200)
  expect(r.headers.get("Set-Cookie")).toContain("HttpOnly")

  return ((await r.json()) as { token: string }).token
}
const complete = async (name: string) => {
  const token = await login(name, TEMP)
  expect(
    (
      await request("auth/password", {
        method: "POST",
        token,
        body: { currentPassword: TEMP, password: PASS },
      })
    ).status,
  ).toBe(200)

  return login(name, PASS)
}
const media = (name: string, token: string, range?: string) =>
  app.request(`/media/${name}`, {
    headers: {
      Cookie: `razzia_media=${token}`,
      ...(range ? { Range: range } : {}),
    },
  })

describe("teacher resource isolation", () => {
  beforeAll(async () => {
    fs.mkdirSync(getPath("quizz"))
    fs.mkdirSync(getPath("media"))
    fs.writeFileSync(getPath("media/retained.png"), PNG)
    fs.writeFileSync(
      getPath("quizz/legacy.json"),
      JSON.stringify({
        id: "legacy",
        ...createQuizz([
          createQuestion({
            media: { url: "/media/retained.png", type: "image" },
          }),
        ]),
      }),
    )
    const store = new LocalDatabase(getPath())
    const inventory = inspectLegacy(getPath())
    migrateLegacy(store, getPath(), inventory.manifestHash)
    store.close()
    const accounts = getAccounts()
    expect(() => assertAccountModeReady()).toThrow()
    await accounts.bootstrap("admin", "Administrator", TEMP)
    activateLocalStore(accounts.store, getPath(), inventory.manifestHash)
    expect(() => assertAccountModeReady()).not.toThrow()
    expect(() => assertLegacyModeReady()).toThrow("refusing legacy")
    admin = await complete("admin")
    const createTeacher = async (loginName: string) => {
      expect(
        (
          await request("users", {
            method: "POST",
            body: {
              login: loginName,
              displayName: loginName,
              role: "teacher",
              password: TEMP,
            },
          })
        ).status,
      ).toBe(201)
    }
    await Promise.all([createTeacher("teacher-a"), createTeacher("teacher-b")])
    teacherA = await complete("teacher-a")
    teacherB = await complete("teacher-b")
    teacherAId = accounts.current(await verifyToken(teacherA)).id
    setIo(fake.io)
  })
  afterAll(() => {
    Registry.getInstance().cleanup()
    getAccounts().store.close()
  })
  it("assigns legacy content privately to the administrator and supports explicit quiz reassignment", async () => {
    expect((await request("quizz", { token: teacherA })).status).toBe(200)
    expect(await (await request("quizz", { token: teacherA })).json()).toEqual({
      quizz: [],
    })
    expect((await request("quizz/legacy", { token: teacherA })).status).toBe(
      404,
    )
    expect(
      (
        await request("quizz/legacy/owner", {
          method: "POST",
          body: { ownerId: teacherAId },
        })
      ).status,
    ).toBe(204)
    expect((await request("quizz/legacy", { token: teacherA })).status).toBe(
      200,
    )
    expect((await request("quizz/legacy", { token: teacherB })).status).toBe(
      404,
    )
    expect((await media("retained.png", teacherA)).status).toBe(200)
    expect((await media("retained.png", teacherB)).status).toBe(404)
  })
  it("assigns imports to the current teacher and rejects forged owner/ID fields and foreign access", async () => {
    const payload = createQuizz([createQuestion()])
    const created = await request("quizz", {
      method: "POST",
      token: teacherA,
      body: { ...payload, id: "legacy", ownerId: "someone-else" },
    })
    expect(created.status).toBe(201)
    sourceId = ((await created.json()) as { id: string }).id
    expect(sourceId).not.toBe("legacy")
    expect(
      (await request(`quizz/${sourceId}`, { token: teacherB })).status,
    ).toBe(404)
    expect(
      (
        await request(`quizz/${sourceId}`, {
          method: "PATCH",
          token: teacherB,
          body: payload,
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await request(`quizz/${sourceId}`, {
          method: "DELETE",
          token: teacherB,
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await request("games", {
          method: "POST",
          token: teacherB,
          body: { quizzId: sourceId },
        })
      ).status,
    ).toBe(404)
    expect((await request("branding", { token: teacherB })).status).toBe(403)
    expect((await request("users", { token: teacherB })).status).toBe(403)
  })
  it("authorizes media bytes, supports ranges and refuses foreign attachment and deletion", async () => {
    const form = new FormData()
    form.append("file", new File([PNG], "own.png", { type: "image/png" }))
    const response = await app.request("/api/media", {
      method: "POST",
      headers: { Authorization: `Bearer ${teacherA}` },
      body: form,
    })
    expect(response.status).toBe(201)
    uploaded = ((await response.json()) as { name: string }).name
    expect((await media(uploaded, teacherB)).status).toBe(404)
    expect((await media(uploaded, admin)).status).toBe(200)
    expect(
      getAccounts()
        .db.prepare(
          "SELECT action,resource_id FROM audit_events WHERE action='media.read' AND resource_id=?",
        )
        .get(uploaded),
    ).toMatchObject({ action: "media.read", resource_id: uploaded })
    const range = await media(uploaded, teacherA, "bytes=0-3")
    expect(range.status).toBe(206)
    expect((await range.arrayBuffer()).byteLength).toBe(4)
    expect(range.headers.get("Cache-Control")).toContain("no-store")
    const payload = createQuizz([
      createQuestion({ media: { url: `/media/${uploaded}`, type: "image" } }),
    ])
    expect(
      (
        await request("quizz", {
          method: "POST",
          token: teacherB,
          body: payload,
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await request(`media/${uploaded}`, {
          method: "DELETE",
          token: teacherB,
        })
      ).status,
    ).toBe(404)
    expect((await request("media", { token: teacherB })).status).toBe(200)
    expect(await (await request("media", { token: teacherB })).json()).toEqual({
      media: [],
    })
  })
  it("keeps game snapshots, player media and reports scoped to the hosting session", async () => {
    const response = await request("games", {
      method: "POST",
      token: teacherA,
      body: { quizzId: "legacy" },
    })
    const { gameId } = (await response.json()) as { gameId: string }
    expect(response.status).toBe(201)
    const game = Registry.getInstance().getGameById(gameId)
    expect(game).toBeDefined()
    expect(
      (
        await request(`games/${gameId}/settings`, {
          method: "PATCH",
          token: teacherB,
          body: { answersOnly: true },
        })
      ).status,
    ).toBe(404)
    const anotherLogin = await login("teacher-a", PASS)
    expect(
      (
        await request(`games/${gameId}/settings`, {
          method: "PATCH",
          token: anotherLogin,
          body: { answersOnly: true },
        })
      ).status,
    ).toBe(404)
    const player = await mintToken("class-player", "player")
    expect((await media("retained.png", player.token)).status).toBe(404)
    game?.join(
      fake.createSocket("player-socket", "class-player"),
      "Participant",
    )
    expect((await media("retained.png", player.token)).status).toBe(200)
    const original = game?.appliedQuiz.questions[0].question
    expect(
      (
        await request("quizz/legacy", {
          method: "PATCH",
          token: teacherA,
          body: createQuizz([createQuestion({ question: "Edited later" })]),
        })
      ).status,
    ).toBe(200)
    expect(game?.appliedQuiz.questions[0].question).toBe(original)
    const result: GameResult = {
      id: "report-a",
      gameMode: "quiz",
      subject: "Applied snapshot",
      date: new Date().toISOString(),
      players: [],
      questions: [],
    }
    localResources.saveResult(gameId, result)
    expect(
      (await request("results/report-a", { token: teacherA })).status,
    ).toBe(200)
    expect(
      (await request("results/report-a", { token: teacherB })).status,
    ).toBe(404)
    expect(
      (await request("results/report-a", { method: "DELETE", token: teacherB }))
        .status,
    ).toBe(404)
    expect(
      await (await request("results", { token: teacherB })).json(),
    ).toEqual({ results: [] })
    expect(
      (await request("media/retained.png", { method: "DELETE" })).status,
    ).toBe(409)
    Registry.getInstance().removeGame(gameId)
    expect((await media("retained.png", player.token)).status).toBe(404)
  })
  it("preserves fractional estimation answers in stored report snapshots", () => {
    const question = {
      ...createQuestion({
        type: "estimation",
        answers: [],
        solutions: [1.5],
        options: { inputMode: "input", min: 0, max: 3, step: 0.5, margin: 0.5 },
      }),
      playerAnswers: [
        {
          playerName: "Synthetic",
          answerIds: [1.5],
          correct: true,
          points: 1000,
        },
      ],
    }
    const result = parseLegacyResult({
      id: "estimate-report",
      subject: "Estimate",
      date: new Date().toISOString(),
      gameMode: "quiz",
      players: [],
      questions: [question],
    })
    expect(result.questions[0].playerAnswers[0].answerIds).toEqual([1.5])
  })
  it("retries PIN collisions and stops after a bounded number of failures", () => {
    const generate = vi
      .fn()
      .mockReturnValueOnce("123456")
      .mockReturnValue("654321")
    expect(allocateInviteCode(generate, (code) => code === "123456")).toBe(
      "654321",
    )
    const alwaysSame = () =>
      allocateInviteCode(
        () => "123456",
        () => true,
      )
    expect(alwaysSame).toThrow("unused game PIN")
  })
})
