import type { ServerType } from "@hono/node-server"
import { EVENTS } from "@razzia/common/constants"
import type { Server } from "@razzia/common/types/game/socket"
import { clientEventValidators } from "@razzia/common/validators/socket"
import { api } from "@razzia/socket/api"
import { gameSocketHandlers } from "@razzia/socket/handlers/game"
import type { SocketHandler } from "@razzia/socket/handlers/types"
import { verifyToken } from "@razzia/socket/services/auth"
import { DomainError } from "@razzia/socket/services/errors"
import { setIo } from "@razzia/socket/services/io"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { JwtTokenExpired } from "hono/utils/jwt/types"
import { StatusCodes } from "http-status-codes"
import { Server as ServerIO } from "socket.io"
import type { z } from "zod"

import { authMode } from "@razzia/socket/env"
import { getAccounts, accountEvents } from "@razzia/socket/services/accounts"

const eventValidators: Partial<Record<string, z.ZodType>> =
  clientEventValidators

export const app = new Hono()

import { serveTrainingMedia } from "@razzia/socket/services/private-media"

app.route("/api", api)
app.get("/media/:name", serveTrainingMedia)

app.notFound((c) =>
  c.json({ error: "errors:api.notFound" }, StatusCodes.NOT_FOUND),
)

const HTTP_ERROR_KEYS: Partial<Record<number, string>> = {
  [StatusCodes.BAD_REQUEST]: "errors:invalidRequest",
  [StatusCodes.UNAUTHORIZED]: "errors:auth.unauthorized",
  [StatusCodes.FORBIDDEN]: "errors:auth.unauthorized",
  [StatusCodes.NOT_FOUND]: "errors:api.notFound",
}

app.onError((error, c) => {
  if (error instanceof DomainError) {
    if (error.status >= StatusCodes.INTERNAL_SERVER_ERROR) {
      console.error("API error:", error)
    }

    return c.json({ error: error.key }, error.status)
  }

  if (error instanceof HTTPException) {
    return c.json(
      { error: HTTP_ERROR_KEYS[error.status] ?? "errors:api.serverError" },
      error.status,
    )
  }

  console.error("Unhandled API error:", error)

  return c.json(
    { error: "errors:api.serverError" },
    StatusCodes.INTERNAL_SERVER_ERROR,
  )
})

const socketHandlers: SocketHandler[] = [gameSocketHandlers]

const authError = (code: string, message: string) => {
  const error = new Error(message) as Error & { data: { code: string } }
  error.data = { code }

  return error
}

export const createSocketServer = (server: ServerType): Server => {
  const io: Server = new ServerIO(server, {
    path: "/ws",
  })

  setIo(io)
  const revoke = (sid: string) =>
    io.in(`account-session:${sid}`).disconnectSockets(true)
  accountEvents.on("revoked", revoke)
  server.once("close", () => accountEvents.off("revoked", revoke))

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined

    if (!token) {
      next(authError("TOKEN_MISSING", "errors:auth.tokenMissing"))

      return
    }

    verifyToken(token)
      .then((claims) => {
        if (
          authMode === "local" &&
          claims.role === "manager" &&
          getAccounts().current(claims).mustReset
        ) {
          next(authError("TOKEN_INVALID", "errors:accounts.changeRequired"))

          return
        }

        socket.data = {
          claims,
          clientId: claims.sub,
          role: claims.role,
        }

        next()
      })
      .catch((error: unknown) => {
        const code =
          error instanceof JwtTokenExpired ? "TOKEN_EXPIRED" : "TOKEN_INVALID"

        next(authError(code, "errors:auth.tokenInvalid"))
      })
  })

  io.on("connection", (socket) => {
    console.log(
      `A user connected: socketId: ${socket.id}, clientId: ${socket.data.clientId}`,
    )

    if (authMode === "local" && socket.data.claims?.sid) {
      socket.join(`account-session:${socket.data.claims.sid}`)
      const timeout = setTimeout(
        () => socket.disconnect(true),
        Math.max(1, socket.data.claims.exp * 1000 - Date.now()),
      )
      timeout.unref()
      socket.once("disconnect", () => clearTimeout(timeout))
    }

    socket.use((packet, next) => {
      if (packet[0].startsWith("manager:") && socket.data.role !== "manager") {
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:auth.unauthorized")

        return
      }

      if (authMode === "local" && socket.data.role === "manager") {
        try {
          const { claims } = socket.data

          if (
            !claims ||
            claims.exp * 1000 <= Date.now() ||
            getAccounts().current(claims).mustReset
          ) {
            throw new Error("Session revoked")
          }
        } catch {
          socket.disconnect(true)

          return
        }
      }

      const validator = eventValidators[packet[0]]

      if (!validator) {
        next()

        return
      }

      const result = validator.safeParse(packet[1])

      if (!result.success) {
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:invalidRequest")

        return
      }

      packet[1] = result.data
      next()
    })

    socketHandlers.forEach((handler) => {
      handler({ io, socket })
    })
  })

  return io
}
