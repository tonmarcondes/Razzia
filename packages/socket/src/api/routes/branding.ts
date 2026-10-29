import { zValidator } from "@hono/zod-validator"
import {
  BRANDING_ASSET_MAX_SIZE,
  brandingWriteValidator,
  brandingResetValidator,
  brandingUploadValidator,
} from "@razzia/common/validators/branding"
import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager } from "@razzia/socket/api/middleware"
import {
  readBranding,
  writeBranding,
  resetBranding,
  uploadBrandingAsset,
} from "@razzia/socket/services/branding"
import { bodyLimit } from "hono/body-limit"

const invalid = (c: {
  json: (body: { error: string }, status: 400) => Response
}) => c.json({ error: "errors:branding.invalidTheme" }, 400)
const routes = apiFactory
  .createApp()
  .use(requireManager)
  .use(async (c, next) => {
    c.header("Cache-Control", "no-store")
    await next()
  })
  .get("/", (c) => c.json(readBranding()))
  .put(
    "/",
    bodyLimit({ maxSize: 64 * 1024 }),
    zValidator("json", brandingWriteValidator, (result, c) => {
      if (!result.success) {
        return invalid(c)
      }
    }),
    (c) => {
      const { theme, revision } = c.req.valid("json")

      return c.json(writeBranding(theme, revision))
    },
  )
  .delete(
    "/",
    zValidator("json", brandingResetValidator, (result, c) => {
      if (!result.success) {
        return invalid(c)
      }
    }),
    (c) => {
      resetBranding(c.req.valid("json").revision)

      return c.body(null, 204)
    },
  )
  .post(
    "/assets",
    bodyLimit({
      maxSize: BRANDING_ASSET_MAX_SIZE + 64 * 1024,
      onError: (c) => c.json({ error: "errors:branding.invalidAsset" }, 413),
    }),
    zValidator("form", brandingUploadValidator, (result, c) => {
      if (!result.success) {
        return c.json({ error: "errors:branding.invalidAsset" }, 400)
      }
    }),
    async (c) =>
      c.json(await uploadBrandingAsset(c.req.valid("form").file), 201),
  )

export const branding = routes
