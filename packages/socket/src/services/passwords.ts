import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { invalidInput, DomainError } from "@razzia/socket/services/errors"

export interface PasswordPolicy {
  minLength: number
  upper: boolean
  lower: boolean
  digit: boolean
  symbol: boolean
}

export const passwordPolicy: PasswordPolicy = {
  minLength: Number(process.env.AUTH_PASSWORD_MIN_LENGTH ?? 15),
  upper: process.env.AUTH_PASSWORD_REQUIRE_UPPER === "true",
  lower: process.env.AUTH_PASSWORD_REQUIRE_LOWER === "true",
  digit: process.env.AUTH_PASSWORD_REQUIRE_DIGIT === "true",
  symbol: process.env.AUTH_PASSWORD_REQUIRE_SYMBOL === "true",
}

if (
  !Number.isInteger(passwordPolicy.minLength) ||
  passwordPolicy.minLength < 8 ||
  passwordPolicy.minLength > 128
) {
  throw new Error("AUTH_PASSWORD_MIN_LENGTH must be between 8 and 128")
}

for (const key of ["UPPER", "LOWER", "DIGIT", "SYMBOL"]) {
  const value = process.env[`AUTH_PASSWORD_REQUIRE_${key}`]

  if (value !== undefined && value !== "true" && value !== "false") {
    throw new Error("Password composition switches must be true or false")
  }
}
const BLOCKED = new Set([
  "passwordpassword",
  "password123456789",
  "123456789012345",
  "1234567890123456",
  "qwertyuiopasdfgh",
  "administrador123",
  "administrator123",
  "senha1234567890",
  "letmeinletmeinletmein",
])

export const validatePassword = (password: string, policy = passwordPolicy) => {
  if (
    Array.from(password).length < policy.minLength ||
    password.length > 256 ||
    BLOCKED.has(password.toLowerCase()) ||
    /^(.)\1+$/u.test(password) ||
    (policy.upper && !/\p{Lu}/u.test(password)) ||
    (policy.lower && !/\p{Ll}/u.test(password)) ||
    (policy.digit && !/\p{N}/u.test(password)) ||
    (policy.symbol && !/[^\p{L}\p{N}\s]/u.test(password))
  ) {
    throw invalidInput("errors:accounts.passwordPolicy")
  }
}

const N = 32768,
  R = 8,
  P = 3
let running = 0
const derive = async (password: string, salt: Buffer) => {
  if (running >= 2) {
    throw new DomainError("errors:accounts.busy", 429)
  }

  running += 1

  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password,
        salt,
        32,
        { N, r: R, p: P, maxmem: 64 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      )
    })
  } finally {
    running -= 1
  }
}

export const hashPassword = async (password: string) => {
  validatePassword(password)
  const salt = randomBytes(16)
  const key = await derive(password, salt)

  return `scrypt$v1$${N}$${R}$${P}$${salt.toString("hex")}$${key.toString("hex")}`
}

export const verifyPassword = async (password: string, hash: string | null) => {
  const parts = hash?.split("$") ?? []
  const valid =
    parts.length === 7 &&
    parts[0] === "scrypt" &&
    parts[1] === "v1" &&
    parts[2] === String(N) &&
    parts[3] === String(R) &&
    parts[4] === String(P) &&
    /^[a-f0-9]{32}$/u.test(parts[5]) &&
    /^[a-f0-9]{64}$/u.test(parts[6])
  const key = await derive(
    password,
    valid ? Buffer.from(parts[5], "hex") : Buffer.alloc(16),
  )

  return valid && timingSafeEqual(key, Buffer.from(parts[6], "hex"))
}
