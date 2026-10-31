import { zValidator } from "@hono/zod-validator"
import { MAX_MEDIA_SIZE } from "@razzia/common/constants"
import { mediaUploadValidator } from "@razzia/common/validators/quizz"
import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager } from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import {
  deleteMedia,
  listMedia,
  saveMedia,
} from "@razzia/socket/services/media"
import { bodyLimit } from "hono/body-limit"
import { StatusCodes } from "http-status-codes"

import { authMode } from "@razzia/socket/env"
import { localResources } from "@razzia/socket/services/local-resources"

const MULTIPART_OVERHEAD = 64 * 1024

const routes = apiFactory
  .createApp()
  .use(requireManager)
  .get("/", (c) =>
    c.json({
      media:
        authMode === "local"
          ? localResources.media(c.get("claims"))
          : listMedia(),
    }),
  )
  .post(
    "/",
    bodyLimit({
      maxSize: MAX_MEDIA_SIZE + MULTIPART_OVERHEAD,
      onError: (c) =>
        c.json(
          { error: "errors:media.tooLarge" },
          StatusCodes.REQUEST_TOO_LONG,
        ),
    }),
    zValidator("form", mediaUploadValidator, i18nHook),
    async (c) =>
      c.json(
        await (authMode === "local"
          ? localResources.upload(c.get("claims"), c.req.valid("form").file)
          : saveMedia(c.req.valid("form").file)),
        StatusCodes.CREATED,
      ),
  )
  .delete("/:name", (c) => {
    if (authMode === "local") {
      localResources.deleteMedia(c.get("claims"), c.req.param("name"))
    } else {
      deleteMedia(c.req.param("name"))
    }

    return c.body(null, StatusCodes.NO_CONTENT)
  })

export const media = routes
