import type { SessionClaims } from "@razzia/common/types/auth"
import {
  accountLogin,
  createAccountValidator,
  type AccountPublic,
} from "@razzia/common/validators/accounts"
import { LocalDatabase } from "@razzia/socket/storage/database"
import { HOLDING_OWNER_ID } from "@razzia/socket/storage/legacy-migration"
import { getPath } from "@razzia/socket/services/config"
import {
  DomainError,
  invalidInput,
  notFound,
} from "@razzia/socket/services/errors"
import { hashPassword, verifyPassword } from "@razzia/socket/services/passwords"
import { randomUUID } from "node:crypto"
import { EventEmitter } from "node:events"
import fs from "node:fs"
import type { SQLOutputValue } from "node:sqlite"

const unauthorized = () =>
  new DomainError("errors:accounts.invalidCredentials", 403)

export const accountEvents = new EventEmitter()

const now = () => new Date().toISOString()
const seconds = () => Math.floor(Date.now() / 1000)
const publicAccount = (row: Record<string, SQLOutputValue>): AccountPublic => ({
  id: String(row.id),
  login: String(row.login),
  displayName: String(row.display_name),
  role: row.role as AccountPublic["role"],
  active: row.active === 1,
  mustReset: row.must_reset === 1,
})

export class Accounts {
  readonly store: LocalDatabase

  constructor(store: LocalDatabase) {
    this.store = store
  }
  get db() {
    return this.store.connection
  }
  audit(actor: string, action: string, resource: string) {
    this.db
      .prepare(
        "INSERT INTO audit_events (actor_id,action,resource_id,created_at) VALUES (?,?,?,?)",
      )
      .run(actor, action, resource, now())
  }
  list() {
    return this.db
      .prepare(
        "SELECT id,login,display_name,role,active,must_reset FROM users ORDER BY login",
      )
      .all()
      .map(publicAccount)
  }
  get(id: string) {
    const row = this.db
      .prepare(
        "SELECT id,login,display_name,role,active,must_reset FROM users WHERE id=?",
      )
      .get(id)

    if (!row) {
      throw notFound("errors:accounts.notFound")
    }

    return publicAccount(row)
  }
  async bootstrap(login: string, displayName: string, password: string) {
    const normalized = accountLogin.parse(login)
    const validated = createAccountValidator.parse({
      login: normalized,
      displayName,
      role: "admin",
      password,
    })
    const hash = await hashPassword(password)

    return this.store.transaction(() => {
      if (
        this.db
          .prepare("SELECT value FROM metadata WHERE key='bootstrap-complete'")
          .get()
      ) {
        throw invalidInput("errors:accounts.alreadyInitialized")
      }

      const users = this.list()

      if (users.some((u) => u.id !== HOLDING_OWNER_ID)) {
        throw invalidInput("errors:accounts.alreadyInitialized")
      }

      const date = now()
      this.db
        .prepare(
          "INSERT INTO users (id,login,display_name,role,active,password_hash,must_reset,created_at,updated_at) VALUES (?,?,?,'admin',1,?,1,?,?) ON CONFLICT(id) DO UPDATE SET login=excluded.login,display_name=excluded.display_name,active=1,password_hash=excluded.password_hash,must_reset=1,updated_at=excluded.updated_at",
        )
        .run(
          HOLDING_OWNER_ID,
          normalized,
          validated.displayName,
          hash,
          date,
          date,
        )
      this.db
        .prepare(
          "INSERT INTO metadata (key,value) VALUES ('bootstrap-complete','true')",
        )
        .run()
      this.audit(HOLDING_OWNER_ID, "account.bootstrap", HOLDING_OWNER_ID)

      return this.get(HOLDING_OWNER_ID)
    })
  }
  async create(claims: SessionClaims, input: unknown) {
    const actor = this.admin(claims)
    const data = createAccountValidator.parse(input)
    const hash = await hashPassword(data.password)

    return this.store.transaction(() => {
      this.admin(claims)

      if (
        this.db.prepare("SELECT id FROM users WHERE login=?").get(data.login)
      ) {
        throw invalidInput("errors:accounts.loginExists")
      }

      const id = randomUUID(),
        date = now()
      this.db
        .prepare(
          "INSERT INTO users (id,login,display_name,role,active,password_hash,must_reset,created_at,updated_at) VALUES (?,?,?,?,1,?,1,?,?)",
        )
        .run(id, data.login, data.displayName, data.role, hash, date, date)
      this.audit(actor, "account.create", id)

      return this.get(id)
    })
  }
  admin(claims: SessionClaims) {
    const user = this.current(claims)
    this.requireAdmin(user.id)

    return user.id
  }
  requireAdmin(id: string) {
    const actor = this.get(id)

    if (!actor.active || actor.role !== "admin" || actor.mustReset) {
      throw new DomainError("errors:auth.unauthorized", 403)
    }

    return actor
  }
  async login(login: string, password: string) {
    const row = this.db
      .prepare("SELECT * FROM users WHERE login=?")
      .get(login.toLowerCase().trim())
    const valid = await verifyPassword(
      password,
      (row?.password_hash as string | null) ?? null,
    )

    if (!valid || row?.active !== 1) {
      throw unauthorized()
    }

    return { user: publicAccount(row), hash: String(row.password_hash) }
  }
  createSession(id: string, clientId: string, expectedHash: string) {
    return this.store.transaction(() => {
      const row = this.db.prepare("SELECT * FROM users WHERE id=?").get(id)

      if (row?.active !== 1 || row.password_hash !== expectedHash) {
        throw unauthorized()
      }

      const sid = randomUUID(),
        issued = seconds(),
        expires = issued + 12 * 60 * 60
      this.db
        .prepare(
          "INSERT INTO sessions (id,user_id,client_id,issued_at,expires_at) VALUES (?,?,?,?,?)",
        )
        .run(sid, id, clientId, issued, expires)
      this.audit(id, "session.login", sid)

      return sid
    })
  }
  current(claims: SessionClaims) {
    if (!claims.sid) {
      throw unauthorized()
    }

    const row = this.db
      .prepare(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=? AND s.client_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.active=1",
      )
      .get(claims.sid, claims.sub, seconds())

    if (!row) {
      throw unauthorized()
    }

    return publicAccount(row)
  }
  revoke(userId: string, sessionId?: string) {
    const rows = this.db
      .prepare("SELECT id FROM sessions WHERE user_id=? AND revoked_at IS NULL")
      .all(userId)
    this.db
      .prepare(
        "UPDATE sessions SET revoked_at=? WHERE user_id=? AND (? IS NULL OR id=?)",
      )
      .run(seconds(), userId, sessionId ?? null, sessionId ?? null)
    for (const row of rows) {
      if (!sessionId || row.id === sessionId) {
        accountEvents.emit("revoked", String(row.id))
      }
    }
  }
  update(
    claims: SessionClaims,
    id: string,
    input: {
      displayName: string
      role: AccountPublic["role"]
      active: boolean
    },
  ) {
    this.store.transaction(() => {
      const actor = this.admin(claims)
      const target = this.get(id)

      if (
        target.active &&
        target.role === "admin" &&
        (!input.active || input.role !== "admin") &&
        this.list().filter((u) => u.active && u.role === "admin").length <= 1
      ) {
        throw invalidInput("errors:accounts.lastAdmin")
      }

      this.db
        .prepare(
          "UPDATE users SET display_name=?,role=?,active=?,updated_at=? WHERE id=?",
        )
        .run(input.displayName, input.role, Number(input.active), now(), id)
      this.audit(actor, "account.update", id)
    })
    this.revoke(id)

    return this.get(id)
  }
  async reset(claims: SessionClaims, id: string, password: string) {
    const actor = this.admin(claims)
    const hash = await hashPassword(password)
    this.store.transaction(() => {
      this.admin(claims)
      this.get(id)
      this.db
        .prepare(
          "UPDATE users SET password_hash=?,must_reset=1,updated_at=? WHERE id=?",
        )
        .run(hash, now(), id)
      this.audit(actor, "account.reset", id)
    })
    this.revoke(id)
  }
  async change(
    claims: SessionClaims,
    currentPassword: string,
    password: string,
  ) {
    const user = this.current(claims)
    const row = this.db
      .prepare("SELECT password_hash FROM users WHERE id=?")
      .get(user.id)
    const previous = String(row?.password_hash)

    if (!(await verifyPassword(currentPassword, previous))) {
      throw unauthorized()
    }

    if (await verifyPassword(password, previous)) {
      throw invalidInput("errors:accounts.passwordReused")
    }

    const hash = await hashPassword(password)
    this.store.transaction(() => {
      this.current(claims)

      if (
        this.db
          .prepare("SELECT password_hash FROM users WHERE id=?")
          .get(user.id)?.password_hash !== previous
      ) {
        throw unauthorized()
      }

      this.db
        .prepare(
          "UPDATE users SET password_hash=?,must_reset=0,updated_at=? WHERE id=?",
        )
        .run(hash, now(), user.id)
      this.audit(user.id, "account.password", user.id)
    })
    this.revoke(user.id)
  }
}

let instance: Accounts | undefined = undefined

export const getAccounts = () => {
  if (!instance) {
    if (!fs.existsSync(getPath("accounts/accounts.sqlite"))) {
      throw new Error("Account database has not been migrated")
    }

    instance = new Accounts(new LocalDatabase(getPath()))
  }

  return instance
}

export const assertAccountModeReady = () => {
  const a = getAccounts()

  if (
    a.db
      .prepare("SELECT value FROM metadata WHERE key='local-mode-ready'")
      .get()?.value !== "true" ||
    a.db
      .prepare("SELECT value FROM metadata WHERE key='bootstrap-complete'")
      .get()?.value !== "true" ||
    a.db
      .prepare(
        "SELECT count(*) AS count FROM media WHERE classification!='private'",
      )
      .get()?.count !== 0 ||
    !a.list().some((user) => user.role === "admin" && user.active)
  ) {
    throw new Error(
      "Local account mode requires migration, bootstrap and explicit activation",
    )
  }
}

export const assertLegacyModeReady = () => {
  if (!fs.existsSync(getPath("accounts/accounts.sqlite"))) {
    return
  }

  const store = new LocalDatabase(getPath(), { readOnly: true })

  try {
    if (
      store.connection
        .prepare("SELECT value FROM metadata WHERE key='local-mode-ready'")
        .get()?.value === "true"
    ) {
      throw new Error(
        "This config has switched to local accounts; refusing legacy access",
      )
    }
  } finally {
    store.close()
  }
}
