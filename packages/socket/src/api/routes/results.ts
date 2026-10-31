import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager } from "@razzia/socket/api/middleware"
import {
  deleteResult,
  getResultById,
  getResultsMeta,
} from "@razzia/socket/services/config"
import { StatusCodes } from "http-status-codes"

import { authMode } from "@razzia/socket/env"
import { localResources } from "@razzia/socket/services/local-resources"

const routes = apiFactory
  .createApp()
  .use(requireManager)
  .get("/", (c) =>
    c.json({
      results:
        authMode === "local"
          ? localResources.results(c.get("claims"))
          : getResultsMeta(),
    }),
  )
  .get("/:id", (c) =>
    c.json(
      authMode === "local"
        ? localResources.result(c.get("claims"), c.req.param("id"))
        : getResultById(c.req.param("id")),
    ),
  )
  .delete("/:id", (c) => {
    if (authMode === "local") {
      localResources.deleteResult(c.get("claims"), c.req.param("id"))
    } else {
      deleteResult(c.req.param("id"))
    }

    return c.body(null, StatusCodes.NO_CONTENT)
  })

export const results = routes
