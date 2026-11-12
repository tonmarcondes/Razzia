import { Hono } from "hono"
import { users } from "@razzia/socket/api/routes/accounts"
import { auth } from "@razzia/socket/api/routes/auth"
import { branding } from "@razzia/socket/api/routes/branding"
import { games } from "@razzia/socket/api/routes/games"
import { media } from "@razzia/socket/api/routes/media"
import { quizz } from "@razzia/socket/api/routes/quizz"
import { results } from "@razzia/socket/api/routes/results"
import { servePublicPage } from "@razzia/socket/services/public-page"

const routes = new Hono()
  .get("/page", servePublicPage)
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/auth", auth)
  .route("/users", users)
  .route("/branding", branding)
  .route("/quizz", quizz)
  .route("/results", results)
  .route("/games", games)
  .route("/media", media)

export const api = routes

export type ApiType = typeof routes
