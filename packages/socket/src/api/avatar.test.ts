import { afterEach, expect, test, vi } from "vitest"
import { z } from "zod"
import { avatarSchema, randomAvatar } from "@razzia/common/avatar"
import { SESSION_ROLES } from "@razzia/common/constants"
import { app } from "@razzia/socket/app"
import { mintToken, verifyJoinTicket } from "@razzia/socket/services/auth"
import Game from "@razzia/socket/services/game"
import Registry from "@razzia/socket/services/registry"
import { createFakeIo } from "@razzia/socket/test/fake-io"
import { createQuestion, createQuizz } from "@razzia/socket/test/fixtures"
const responseSchema = z.object({
  gameId: z.string(),
  ticket: z.string().nullable(),
  avatarSetup: z
    .object({
      deadline: z.number(),
      serverNow: z.number(),
      avatar: avatarSchema,
    })
    .nullable(),
})
const setup = async (enabled = true) => {
  const fake = createFakeIo(),
    game = new Game(fake.io, "manager", createQuizz([createQuestion()]))
  game.updateSettings({ avatars: { enabled, seconds: 10 } })
  Registry.getInstance().addGame(game)
  const { token } = await mintToken("avatar-player", SESSION_ROLES.PLAYER)
  const join = (extra: Record<string, unknown> = {}) =>
    app.request("/api/games/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        inviteCode: game.inviteCode,
        username: "Avatar student",
        ...extra,
      }),
    })

  return { fake, game, join }
}
afterEach(() => {
  Registry.getInstance().cleanup()
  vi.useRealTimers()
})
test("keeps a server deadline on repeated preparation and uses the original random avatar after expiry", async () => {
  vi.useFakeTimers()
  const { join } = await setup()
  const first = responseSchema.parse(await (await join()).json())
  expect(first.ticket).toBeNull()
  expect(first.avatarSetup).not.toBeNull()
  const deadline = first.avatarSetup?.deadline
  vi.setSystemTime(Date.now() + 5000)
  const repeated = responseSchema.parse(await (await join()).json())
  expect(repeated.avatarSetup?.deadline).toBe(deadline)
  vi.setSystemTime(Date.now() + 6000)
  const late = responseSchema.parse(
    await (
      await join({
        avatarReady: true,
        avatar: { ...randomAvatar(), hat: "pilot" },
      })
    ).json(),
  )
  expect(late.avatarSetup).toBeNull()

  if (!late.ticket) {
    throw new Error("Missing finalized ticket")
  }

  expect((await verifyJoinTicket(late.ticket)).avatar).toEqual(
    first.avatarSetup?.avatar,
  )
})
test("signs allowed selections into a join ticket and retains them in the player record", async () => {
  const { join, game, fake } = await setup()
  await join()
  const avatar = {
    ...randomAvatar(),
    hat: "santa" as const,
    eyes: "hearts" as const,
  }
  const result = responseSchema.parse(
    await (await join({ avatarReady: true, avatar })).json(),
  )

  if (!result.ticket) {
    throw new Error("Missing finalized ticket")
  }

  const claims = await verifyJoinTicket(result.ticket)
  expect(claims.avatar).toEqual(avatar)
  const socket = fake.createSocket("avatar-player")
  expect(game.join(socket, claims.username, claims.avatar)).toBeNull()
  expect(game.players[0].avatar).toEqual(avatar)
})
test("rejects unknown options and ignores avatars when the host disables the feature", async () => {
  const { join } = await setup(false)
  expect(
    (await join({ avatar: { ...randomAvatar(), hat: "javascript" } })).status,
  ).toBe(400)
  const result = responseSchema.parse(
    await (await join({ avatarReady: true, avatar: randomAvatar() })).json(),
  )

  if (!result.ticket) {
    throw new Error("Missing ticket")
  }

  expect((await verifyJoinTicket(result.ticket)).avatar).toBeUndefined()
})
