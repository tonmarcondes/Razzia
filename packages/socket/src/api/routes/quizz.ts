import { zValidator } from "@hono/zod-validator"
import { StatusCodes } from "http-status-codes"
import { z } from "zod"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager } from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import { authMode } from "@razzia/socket/env"
import {
  deleteQuizz,
  getQuizzById,
  getQuizzMeta,
  saveQuizz,
  updateQuizz,
} from "@razzia/socket/services/config"
import { localResources } from "@razzia/socket/services/local-resources"

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
  .patch(
    "/:id/visibility",
    zValidator(
      "json",
      z.object({ visibility: z.enum(["private", "public"]) }),
      i18nHook,
    ),
    (c) => {
      if (authMode !== "local") {
        return c.json({ error: "errors:api.notFound" }, 404)
      }

      localResources.setVisibility(
        c.get("claims"),
        c.req.param("id"),
        c.req.valid("json").visibility,
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
