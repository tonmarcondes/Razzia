import { zValidator } from "@hono/zod-validator"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager } from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import {
  deleteQuizz,
  getQuizzById,
  getQuizzMeta,
  saveQuizz,
  updateQuizz,
} from "@razzia/socket/services/config"
import { StatusCodes } from "http-status-codes"

import { authMode } from "@razzia/socket/env"
import { localResources } from "@razzia/socket/services/local-resources"
import { z } from "zod"
import { getAccounts } from "@razzia/socket/services/accounts"

const routes = apiFactory
  .createApp()
  .use(requireManager)
  .get("/", (c) =>
    c.json({
      quizz:
        authMode === "local"
          ? localResources.listQuizzes(c.get("claims"))
          : getQuizzMeta(),
    }),
  )
  .get("/:id", (c) =>
    c.json(
      authMode === "local"
        ? localResources.quiz(c.get("claims"), c.req.param("id")).quizz
        : getQuizzById(c.req.param("id")),
    ),
  )
  .post("/", zValidator("json", quizzValidator, i18nHook), (c) =>
    c.json(
      authMode === "local"
        ? localResources.saveQuiz(c.get("claims"), c.req.valid("json"))
        : saveQuizz(c.req.valid("json")),
      StatusCodes.CREATED,
    ),
  )
  .patch("/:id", zValidator("json", quizzValidator, i18nHook), (c) =>
    c.json(
      authMode === "local"
        ? localResources.saveQuiz(
            c.get("claims"),
            c.req.valid("json"),
            c.req.param("id"),
          )
        : updateQuizz(c.req.param("id"), c.req.valid("json")),
    ),
  )
  .post(
    "/:id/owner",
    zValidator("json", z.object({ ownerId: z.string().min(1) }), i18nHook),
    (c) => {
      if (authMode !== "local") {
        return c.json({ error: "errors:api.notFound" }, 404)
      }

      getAccounts().admin(c.get("claims"))
      localResources.reassign(
        c.get("claims"),
        c.req.param("id"),
        c.req.valid("json").ownerId,
      )

      return c.body(null, 204)
    },
  )
  .delete("/:id", (c) => {
    if (authMode === "local") {
      localResources.deleteQuiz(c.get("claims"), c.req.param("id"))
    } else {
      deleteQuizz(c.req.param("id"))
    }

    return c.body(null, StatusCodes.NO_CONTENT)
  })

export const quizz = routes
