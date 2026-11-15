import z from "zod"
import { avatarSchema } from "@razzia/common/avatar"
import { AUTO_ADVANCE_DELAY } from "@razzia/common/constants"
import {
  inviteCodeValidator,
  usernameValidator,
} from "@razzia/common/validators/auth"

export const createGameValidator = z.object({
  quizzId: z.string().min(1, "errors:quizz.notFound"),
})

export const checkGameValidator = z.object({
  inviteCode: inviteCodeValidator,
})

export const joinGameValidator = z.object({
  avatar: avatarSchema.optional(),
  avatarReady: z.boolean().optional(),
  inviteCode: inviteCodeValidator,
  username: usernameValidator.optional(),
})

const delayValidator = z
  .number()
  .int()
  .min(AUTO_ADVANCE_DELAY.MIN, "errors:game.invalidAutoAdvanceDelay")
  .max(AUTO_ADVANCE_DELAY.MAX, "errors:game.invalidAutoAdvanceDelay")

export const gameSettingsSchema = z.object({
  avatars: z.object({
    enabled: z.boolean(),
    seconds: z.number().int().min(10).max(180),
  }),
  generatedUsernames: z.boolean(),
  answersOnly: z.boolean(),
  autoAdvance: z.object({
    enable: z.boolean(),
    responsesDelay: delayValidator,
    leaderboardDelay: delayValidator,
  }),
})

export const gameSettingsValidator = gameSettingsSchema.partial()
