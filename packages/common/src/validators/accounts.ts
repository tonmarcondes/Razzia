import { z } from "zod"

export const accountLogin = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._@-]{2,63}$/u, "errors:accounts.invalidLogin")

export const accountPassword = z.string().min(1).max(256)

export const accountLoginValidator = z.object({
  login: accountLogin,
  password: accountPassword,
})

export const createAccountValidator = z.object({
  login: accountLogin,
  displayName: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "teacher"]),
  password: accountPassword,
})

export const updateAccountValidator = z.object({
  login: accountLogin.optional(),
  displayName: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "teacher"]),
  active: z.boolean(),
})

export const updateProfileValidator = z.object({
  login: accountLogin,
  displayName: z.string().trim().min(1).max(100),
  currentPassword: accountPassword,
})

export const resetAccountValidator = z.object({ password: accountPassword })

export const changePasswordValidator = z.object({
  currentPassword: accountPassword,
  password: accountPassword,
})

export interface AccountPublic {
  id: string
  login: string
  displayName: string
  role: "admin" | "teacher"
  active: boolean
  mustReset: boolean
}
