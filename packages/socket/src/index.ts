import { createAdaptorServer } from "@hono/node-server"
import { app, createSocketServer } from "@razzia/socket/app"
import { initConfig } from "@razzia/socket/services/config"
import Registry from "@razzia/socket/services/registry"

import { authMode } from "@razzia/socket/env"
import {
  assertLegacyModeReady,
  assertAccountModeReady,
} from "@razzia/socket/services/accounts"

if (authMode === "local") {
  assertAccountModeReady()
} else {
  assertLegacyModeReady()
}

const WS_PORT = Number(process.env.SOCKET_PORT) || 3001

if (authMode === "legacy") {
  initConfig()
}

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error)
})

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason)
})

const server = createAdaptorServer({ fetch: app.fetch })

createSocketServer(server)

server.listen(WS_PORT, () => {
  console.log(`Server running on port ${WS_PORT}`)
})

process.on("SIGINT", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})

process.on("SIGTERM", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})
