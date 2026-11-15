import { expect, test } from "vitest"
import { AVATAR_OPTIONS, avatarSchema, randomAvatar } from "../avatar"
import { gameSettingsValidator } from "../validators/game"

test("rejects arbitrary avatar payloads and permits every catalog option", () => {
  const avatar = randomAvatar()
  expect(avatarSchema.safeParse({ ...avatar, hat: "<script>" }).success).toBe(
    false,
  )
  expect(
    avatarSchema.safeParse({ ...avatar, image: "https://example.com" }).success,
  ).toBe(false)
  Object.entries(AVATAR_OPTIONS).forEach(([key, options]) => {
    options.forEach((value) => {
      expect(avatarSchema.safeParse({ ...avatar, [key]: value }).success).toBe(
        true,
      )
    })
  })
})
test("bounds the teacher's creation time without allowing an infinite window", () => {
  expect(
    gameSettingsValidator.safeParse({ avatars: { enabled: true, seconds: 10 } })
      .success,
  ).toBe(true)
  expect(
    gameSettingsValidator.safeParse({
      avatars: { enabled: true, seconds: 180 },
    }).success,
  ).toBe(true)
  for (const seconds of [0, 9, 181, Infinity, 30.5]) {
    expect(
      gameSettingsValidator.safeParse({ avatars: { enabled: true, seconds } })
        .success,
    ).toBe(false)
  }
})
