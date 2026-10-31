import { zValidator } from "@hono/zod-validator"
import {
  createAccountValidator,
  resetAccountValidator,
  updateAccountValidator,
} from "@razzia/common/validators/accounts"
import { apiFactory } from "@razzia/socket/api/factory"
import {
  requireManager,
  requireAdministrator,
} from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import { authMode } from "@razzia/socket/env"
import { getAccounts } from "@razzia/socket/services/accounts"
import { bodyLimit } from "hono/body-limit"

export const users = apiFactory
  .createApp()
  .use(async (c, next) => {
    c.header("Cache-Control", "no-store")

    if (authMode !== "local") {
      return c.json({ error: "errors:api.notFound" }, 404)
    }

    await next()
  })
  .use(requireManager)
  .use(requireAdministrator)
  .use(bodyLimit({ maxSize: 8192 }))
  .get("/", (c) => c.json({ users: getAccounts().list() }))
  .post("/", zValidator("json", createAccountValidator, i18nHook), async (c) =>
    c.json(
      await getAccounts().create(c.get("claims"), c.req.valid("json")),
      201,
    ),
  )
  .patch("/:id", zValidator("json", updateAccountValidator, i18nHook), (c) =>
    c.json(
      getAccounts().update(
        c.get("claims"),
        c.req.param("id"),
        c.req.valid("json"),
      ),
    ),
  )
  .post(
    "/:id/reset",
    zValidator("json", resetAccountValidator, i18nHook),
    async (c) => {
      await getAccounts().reset(
        c.get("claims"),
        c.req.param("id"),
        c.req.valid("json").password,
      )

      return c.body(null, 204)
    },
  )
