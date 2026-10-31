import { zValidator } from "@hono/zod-validator"
import { SESSION_ROLES } from "@razzia/common/constants"
import type { SessionResponse } from "@razzia/common/types/auth"
import {
  managerLoginValidator,
  sessionRequestValidator,
} from "@razzia/common/validators/auth"
import { readClaims } from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import { authMode, managerPassword } from "@razzia/socket/env"
import {
  mintToken,
  newClientId,
  verifyIgnoringExpiry,
  verifyToken,
} from "@razzia/socket/services/auth"
import { Hono, type Context } from "hono"
import { JwtTokenExpired } from "hono/utils/jwt/types"
import { StatusCodes } from "http-status-codes"

import {
  accountLoginValidator,
  changePasswordValidator,
} from "@razzia/common/validators/accounts"
import { getAccounts } from "@razzia/socket/services/accounts"
import { passwordPolicy } from "@razzia/socket/services/passwords"
import {
  checkLoginLimit,
  clearLoginLimit,
} from "@razzia/socket/services/login-limit"
import { getConnInfo } from "@hono/node-server/conninfo"
import { bodyLimit } from "hono/body-limit"

const readRequestToken = async (c: Context): Promise<string | undefined> => {
  try {
    const result = sessionRequestValidator.safeParse(await c.req.json())

    if (result.success && result.data.token) {
      return result.data.token
    }
  } catch {
    /* Empty */
  }

  const header = c.req.header("Authorization")

  return header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : undefined
}

import { setMediaCookie } from "@razzia/socket/services/media-cookie"

const sessionResponse = (c: Context, session: SessionResponse) => {
  setMediaCookie(c, session.token, session.expiresAt)

  return c.json(session, 200)
}

const freshPlayerSession = (): Promise<SessionResponse> =>
  mintToken(newClientId(), SESSION_ROLES.PLAYER)

const routes = new Hono()
  .use(async (c, next) => {
    c.header("Cache-Control", "no-store")
    await next()
  })
  .use(bodyLimit({ maxSize: 8192 }))
  .get("/config", (c) => c.json({ mode: authMode, passwordPolicy }))
  .get("/me", async (c) => {
    const claims = await readClaims(c)

    if (authMode !== "local") {
      return c.json({ user: null })
    }

    if (!claims || claims.role !== SESSION_ROLES.MANAGER) {
      return c.json({ error: "errors:auth.unauthorized" }, 401)
    }

    return c.json({ user: getAccounts().current(claims) })
  })
  .post(
    "/login",
    zValidator("json", accountLoginValidator, i18nHook),
    async (c) => {
      if (authMode !== "local") {
        return c.json({ error: "errors:api.notFound" }, 404)
      }

      const { login, password } = c.req.valid("json")
      let source = "local"

      try {
        source = getConnInfo(c).remote.address ?? source
      } catch {
        /* In-process tests have no remote socket. */
      }

      checkLoginLimit(source, login)
      const result = await getAccounts().login(login, password)
      const sub = newClientId()
      const sid = getAccounts().createSession(result.user.id, sub, result.hash)
      clearLoginLimit(login)

      return sessionResponse(
        c,
        await mintToken(sub, SESSION_ROLES.MANAGER, sid),
      )
    },
  )
  .post(
    "/password",
    zValidator("json", changePasswordValidator, i18nHook),
    async (c) => {
      const claims = await readClaims(c)

      if (
        authMode !== "local" ||
        !claims ||
        claims.role !== SESSION_ROLES.MANAGER
      ) {
        return c.json({ error: "errors:auth.unauthorized" }, 401)
      }

      const { currentPassword, password } = c.req.valid("json")
      checkLoginLimit("password-change", claims.sid ?? claims.sub)
      await getAccounts().change(claims, currentPassword, password)

      return sessionResponse(
        c,
        await mintToken(newClientId(), SESSION_ROLES.PLAYER),
      )
    },
  )
  .post("/session", async (c) => {
    const token = await readRequestToken(c)

    if (!token) {
      return sessionResponse(c, await freshPlayerSession())
    }

    try {
      const claims = await verifyToken(token)

      return sessionResponse(c, {
        token,
        clientId: claims.sub,
        role: claims.role,
        expiresAt: claims.exp,
      } satisfies SessionResponse)
    } catch (error) {
      if (error instanceof JwtTokenExpired) {
        try {
          const claims = await verifyIgnoringExpiry(token)

          if (authMode === "local" && claims.role === SESSION_ROLES.MANAGER) {
            getAccounts().revoke(getAccounts().current(claims).id, claims.sid)
          }

          return sessionResponse(
            c,
            await mintToken(
              authMode === "local" ? newClientId() : claims.sub,
              SESSION_ROLES.PLAYER,
            ),
          )
        } catch {
          /* Empty */
        }
      }

      return sessionResponse(c, await freshPlayerSession())
    }
  })
  .post(
    "/manager",
    zValidator("json", managerLoginValidator, i18nHook),
    async (c) => {
      if (authMode === "local") {
        return c.json({ error: "errors:auth.unauthorized" }, 403)
      }

      const { password } = c.req.valid("json")

      if (!managerPassword) {
        return c.json(
          { error: "errors:manager.passwordNotConfigured" },
          StatusCodes.FORBIDDEN,
        )
      }

      if (password !== managerPassword) {
        return c.json(
          { error: "errors:manager.invalidPassword" },
          StatusCodes.FORBIDDEN,
        )
      }

      const claims = await readClaims(c)

      return sessionResponse(
        c,
        await mintToken(claims?.sub ?? newClientId(), SESSION_ROLES.MANAGER),
      )
    },
  )
  .post("/logout", async (c) => {
    const claims = await readClaims(c)

    if (!claims) {
      return c.json(
        { error: "errors:auth.unauthorized" },
        StatusCodes.UNAUTHORIZED,
      )
    }

    if (authMode === "local" && claims.role === SESSION_ROLES.MANAGER) {
      getAccounts().revoke(getAccounts().current(claims).id, claims.sid)
    }

    return sessionResponse(
      c,
      await mintToken(
        authMode === "local" ? newClientId() : claims.sub,
        SESSION_ROLES.PLAYER,
      ),
    )
  })

export const auth = routes
