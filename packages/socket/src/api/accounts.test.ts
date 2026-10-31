import { mintToken } from "@razzia/socket/services/auth"
import { app, createSocketServer } from "@razzia/socket/app"
import { getPath } from "@razzia/socket/services/config"
import { getAccounts } from "@razzia/socket/services/accounts"
import { LocalDatabase } from "@razzia/socket/storage/database"
import { createAdaptorServer } from "@hono/node-server"
import { io as connect } from "socket.io-client"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("@razzia/socket/env", () => ({
  authMode: "local",
  jwtSecret: "synthetic-local-accounts-secret-long-enough",
  managerPassword: "legacy-secret",
  gameSpeed: 10,
}))
const TEMP = "A temporary password for tests 10!"
const PASS = "A personal password for tests 11!"
const server = createAdaptorServer({ fetch: app.fetch })
const io = createSocketServer(server)
let adminToken = ""
let url = ""
const request = (
  ...args: [route: string, method?: string, body?: unknown, token?: string]
) => {
  const [route, method = "GET", body, token = adminToken] = args

  return app.request(`/api/${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}
const login = async (name: string, password: string) => {
  const r = await request("auth/login", "POST", { login: name, password }, "")
  expect(r.status).toBe(200)

  return ((await r.json()) as { token: string }).token
}

describe("account HTTP and socket authorization", () => {
  beforeAll(async () => {
    new LocalDatabase(getPath()).close()
    await getAccounts().bootstrap("admin", "Administrator", TEMP)
    const temporary = await login("admin", TEMP)
    expect((await request("quizz", "GET", undefined, temporary)).status).toBe(
      403,
    )
    expect(
      (
        await request(
          "auth/password",
          "POST",
          { currentPassword: TEMP, password: PASS },
          temporary,
        )
      ).status,
    ).toBe(200)
    expect((await request("auth/me", "GET", undefined, temporary)).status).toBe(
      401,
    )
    adminToken = await login("admin", PASS)
    await new Promise<void>((resolve) => {
      server.listen(0, resolve)
    })
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(async () => {
    await io.close()
    getAccounts().store.close()
  })
  it("rejects the legacy password and sessions without an account mapping", async () => {
    expect(
      (await request("auth/manager", "POST", { password: "legacy-secret" }, ""))
        .status,
    ).toBe(403)
    expect((await request("users", "GET", undefined, "")).status).toBe(401)
  })
  it("provides safe account fields and prevents teacher administration", async () => {
    const created = await request("users", "POST", {
      login: "api-teacher",
      displayName: "Professor",
      role: "teacher",
      password: TEMP,
    })
    expect(created.status).toBe(201)
    const text = await created.text()
    expect(text).not.toContain("password")
    const temporary = await login("api-teacher", TEMP)
    expect(
      (
        await request(
          "auth/password",
          "POST",
          { currentPassword: TEMP, password: PASS },
          temporary,
        )
      ).status,
    ).toBe(200)
    const token = await login("api-teacher", PASS)
    expect((await request("users", "GET", undefined, token)).status).toBe(403)
    const me = await request("auth/me", "GET", undefined, token)
    expect(await me.json()).toMatchObject({
      user: { login: "api-teacher", role: "teacher", mustReset: false },
    })
  })
  it("does not allow an anonymous player to issue manager events", async () => {
    const { token } = await mintToken("downgraded-client", "player")
    const client = connect(url, {
      path: "/ws",
      transports: ["websocket"],
      forceNew: true,
      auth: { token },
      reconnection: false,
    })

    try {
      await new Promise<void>((resolve, reject) => {
        client.once("connect", resolve)
        client.once("connect_error", reject)
      })
      const denied = new Promise<string>((resolve) => {
        client.once("game:errorMessage", resolve)
      })
      client.emit("manager:startGame", { gameId: "guessed-game" })
      expect(await denied).toBe("errors:auth.unauthorized")
    } finally {
      client.close()
    }
  })
  it("disconnects an open socket and rejects its JWT immediately on logout", async () => {
    const token = await login("admin", PASS)
    const client = connect(url, {
      path: "/ws",
      transports: ["websocket"],
      forceNew: true,
      auth: { token },
      reconnection: false,
    })

    try {
      await new Promise<void>((resolve, reject) => {
        client.once("connect", resolve)
        client.once("connect_error", reject)
      })
      const disconnected = new Promise<void>((resolve) => {
        client.once("disconnect", () => resolve())
      })
      expect(
        (await request("auth/logout", "POST", undefined, token)).status,
      ).toBe(200)
      await disconnected
      expect((await request("auth/me", "GET", undefined, token)).status).toBe(
        401,
      )
    } finally {
      client.close()
    }
  })
})
