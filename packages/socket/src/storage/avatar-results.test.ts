import { expect, test } from "vitest"
import { randomAvatar } from "@razzia/common/avatar"
import { parseLegacyResult } from "./legacy-validation"

test("retains optional validated avatars without weakening strict result validation", () => {
  const avatar = randomAvatar()
  const result = {
    id: "synthetic-avatar-result",
    gameMode: "quiz",
    subject: "Synthetic result",
    date: new Date().toISOString(),
    players: [{ username: "Student", rank: 1, points: 1000, avatar }],
    questions: [
      {
        type: "single",
        question: "Synthetic",
        answers: ["A", "B"],
        solutions: [0],
        cooldown: 3,
        time: 30,
        playerAnswers: [
          {
            playerName: "Student",
            answerIds: [0],
            correct: true,
            points: 1000,
          },
        ],
      },
    ],
  }
  expect(parseLegacyResult(result).players[0].avatar).toEqual(avatar)
  expect(
    parseLegacyResult({
      ...result,
      players: [{ username: "Legacy student", rank: 1, points: 1000 }],
    }).players[0].avatar,
  ).toBeUndefined()
  expect(() =>
    parseLegacyResult({
      ...result,
      players: [
        { ...result.players[0], avatar: { ...avatar, hat: "untrusted" } },
      ],
    }),
  ).toThrow()
  expect(() =>
    parseLegacyResult({
      ...result,
      players: [{ ...result.players[0], unrecognizedField: true }],
    }),
  ).toThrow()
})
