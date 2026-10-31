import { createHash } from "node:crypto"
import { DomainError } from "@razzia/socket/services/errors"

const WINDOW = 15 * 60 * 1000
const entries = new Map<string, { count: number; until: number }>()

export const checkLoginLimit = (source: string, login: string) => {
  const time = Date.now()
  for (const [key, value] of entries) {
    if (value.until <= time) {
      entries.delete(key)
    }
  }

  if (entries.size > 10000) {
    throw new DomainError("errors:accounts.rateLimited", 429)
  }

  for (const [name, limit] of [
    [`source:${source}`, 100],
    [
      `account:${createHash("sha256").update(login.toLowerCase()).digest("hex")}`,
      8,
    ],
  ] as const) {
    const entry = entries.get(name) ?? { count: 0, until: time + WINDOW }

    if (entry.count >= limit) {
      throw new DomainError("errors:accounts.rateLimited", 429)
    }

    entry.count += 1
    entries.set(name, entry)
  }
}

export const clearLoginLimit = (login: string) =>
  entries.delete(
    `account:${createHash("sha256").update(login.toLowerCase()).digest("hex")}`,
  )
