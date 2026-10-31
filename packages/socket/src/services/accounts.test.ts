import { Accounts, accountEvents } from "@razzia/socket/services/accounts"
import { LocalDatabase } from "@razzia/socket/storage/database"
import {
  validatePassword,
  hashPassword,
  verifyPassword,
} from "@razzia/socket/services/passwords"
import {
  checkLoginLimit,
  clearLoginLimit,
} from "@razzia/socket/services/login-limit"
import type { SessionClaims } from "@razzia/common/types/auth"
import fs from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const TEMP = "Temporary password for tests 01!"
const PASS = "My personal test passphrase 02!"
let root = ""
let accounts: Accounts | undefined = undefined
let store: LocalDatabase | undefined = undefined
let admin: SessionClaims | undefined = undefined
const service = () => {
  if (!accounts) {
    throw Error("Not initialized")
  }

  return accounts
}
const claimsFor = async (
  login: string,
  password: string,
): Promise<SessionClaims> => {
  const result = await service().login(login, password)
  const sub = crypto.randomUUID()
  const sid = service().createSession(result.user.id, sub, result.hash)

  return {
    sub,
    sid,
    role: "manager",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
}
beforeAll(async () => {
  root = fs.realpathSync(
    fs.mkdtempSync(path.join(tmpdir(), "razzia-accounts-")),
  )
  store = new LocalDatabase(root)
  accounts = new Accounts(store)
  await service().bootstrap("admin", "Administrator", TEMP)
  const temporary = await claimsFor("admin", TEMP)
  await service().change(temporary, TEMP, PASS)
  admin = await claimsFor("admin", PASS)
})
afterAll(() => {
  store?.close()
  fs.rmSync(root, { recursive: true, force: true })
})
const administrator = () => {
  if (!admin) {
    throw Error("Not initialized")
  }

  return admin
}

describe("local accounts", () => {
  it("uses salted versioned hashes, preserves spaces and rejects a common password", async () => {
    const password = "  long phrase with spaces  "
    const a = await hashPassword(password),
      b = await hashPassword(password)
    expect(a).not.toBe(b)
    expect(a).toMatch(/^scrypt\$v1\$32768\$8\$3\$/u)
    expect(await verifyPassword(password, a)).toBe(true)
    expect(await verifyPassword(password.trim(), a)).toBe(false)
    expect(() => validatePassword("123456789012345")).toThrow("passwordPolicy")
    expect(() =>
      validatePassword("long enough phrase", {
        minLength: 15,
        upper: true,
        lower: false,
        digit: false,
        symbol: false,
      }),
    ).toThrow()
  })
  it("does not expose password hashes in account serializers or audit", () => {
    expect(JSON.stringify(service().list())).not.toContain("password_hash")
    expect(
      JSON.stringify(service().db.prepare("SELECT * FROM audit_events").all()),
    ).not.toContain(TEMP)
  })
  it("requires one-time bootstrap and protects the last administrator", async () => {
    await expect(
      service().bootstrap("other-admin", "Another", TEMP),
    ).rejects.toThrow("alreadyInitialized")
    const user = service().current(administrator())
    expect(() =>
      service().update(administrator(), user.id, {
        displayName: user.displayName,
        role: "teacher",
        active: true,
      }),
    ).toThrow("lastAdmin")
    expect(() =>
      service().update(administrator(), user.id, {
        displayName: user.displayName,
        role: "admin",
        active: false,
      }),
    ).toThrow("lastAdmin")
  })
  it("requires reset, creates independent browser identities and revokes all sessions on change", async () => {
    const user = await service().create(administrator(), {
      login: "teacher1",
      displayName: "Teacher One",
      role: "teacher",
      password: TEMP,
    })
    expect(user.mustReset).toBe(true)
    const a = await claimsFor("teacher1", TEMP),
      b = await claimsFor("teacher1", TEMP)
    expect(a.sub).not.toBe(b.sub)
    expect(() => service().admin(a)).toThrow()
    const revoked = vi.fn()
    accountEvents.on("revoked", revoked)

    try {
      await service().change(a, TEMP, PASS)
    } finally {
      accountEvents.off("revoked", revoked)
    }

    expect(revoked).toHaveBeenCalledWith(a.sid)
    expect(revoked).toHaveBeenCalledWith(b.sid)
    expect(() => service().current(a)).toThrow("invalidCredentials")
    expect(() => service().current(b)).toThrow("invalidCredentials")
    expect(service().current(await claimsFor("teacher1", PASS)).mustReset).toBe(
      false,
    )
  })
  it("resets and disables accounts without permitting old sessions to return", async () => {
    const user = await service().create(administrator(), {
      login: "teacher2",
      displayName: "Teacher Two",
      role: "teacher",
      password: TEMP,
    })
    const old = await claimsFor("teacher2", TEMP)
    await service().reset(
      administrator(),
      user.id,
      "Another temporary passphrase 03!",
    )
    expect(() => service().current(old)).toThrow()
    const current = await claimsFor(
      "teacher2",
      "Another temporary passphrase 03!",
    )
    service().update(administrator(), user.id, {
      displayName: user.displayName,
      role: "teacher",
      active: false,
    })
    expect(() => service().current(current)).toThrow()
    await expect(
      service().login("teacher2", "Another temporary passphrase 03!"),
    ).rejects.toThrow("invalidCredentials")
  })
  it("cannot use a session ID from a different client or a revoked admin session", async () => {
    expect(() =>
      service().current({ ...administrator(), sub: "another-browser" }),
    ).toThrow()
    const other = await claimsFor("admin", PASS)
    service().revoke(service().current(other).id, other.sid)
    await expect(
      service().create(other, {
        login: "forbidden",
        displayName: "Forbidden",
        role: "teacher",
        password: TEMP,
      }),
    ).rejects.toThrow()
  })
  it("limits attempts by account regardless of submitted source", () => {
    clearLoginLimit("rate-account")
    for (let i = 0; i < 8; i += 1) {
      checkLoginLimit(`source-${i}`, "rate-account")
    }
    expect(() => checkLoginLimit("new-source", "rate-account")).toThrow(
      "rateLimited",
    )
    clearLoginLimit("rate-account")
  })
})
