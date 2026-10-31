import type { GameResult } from "@razzia/common/types/game"
import {
  normalizeLegacyQuizz,
  quizzValidator,
} from "@razzia/common/validators/quizz"
import { z } from "zod"

const playerAnswer = z.strictObject({
  playerName: z.string(),
  answerIds: z.array(z.number()).nullable(),
  correct: z.boolean().optional(),
  points: z.number().optional(),
})
const resultEnvelope = z.strictObject({
  id: z.string().min(1),
  gameMode: z.enum(["quiz", "survey"]).default("quiz"),
  subject: z.string().min(1),
  date: z.iso.datetime({ offset: true }),
  players: z.array(
    z.strictObject({
      username: z.string(),
      points: z.number(),
      rank: z.number().int().min(1),
    }),
  ),
  questions: z.array(z.record(z.string(), z.unknown())),
})

/** Zod objects strip unknown keys; migration must instead report data loss. */
const assertNoDroppedFields = (input: unknown, parsed: unknown) => {
  if (
    !input ||
    typeof input !== "object" ||
    !parsed ||
    typeof parsed !== "object"
  ) {
    return
  }

  if (Array.isArray(input) && Array.isArray(parsed)) {
    input.forEach((value, i) => {
      assertNoDroppedFields(value, parsed[i])
    })

    return
  }

  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(parsed, key)) {
      throw new Error("unsupported-fields")
    }

    assertNoDroppedFields(
      (input as Record<string, unknown>)[key],
      (parsed as Record<string, unknown>)[key],
    )
  }
}

export const parseLegacyQuiz = (input: unknown) => {
  const normalized = normalizeLegacyQuizz(input)
  const parsed = quizzValidator.parse(normalized)

  assertNoDroppedFields(normalized, parsed)

  return parsed
}

export const parseLegacyResult = (input: unknown): GameResult => {
  const result = resultEnvelope.parse(input)
  const questions = result.questions.map(({ playerAnswers, ...question }) => {
    const parsed = parseLegacyQuiz({
      gameMode: result.gameMode,
      subject: result.subject,
      questions: [question],
    })
    const [validated] = parsed.questions

    return {
      ...validated,
      playerAnswers: z.array(playerAnswer).parse(playerAnswers),
    }
  })

  return { ...result, questions }
}
