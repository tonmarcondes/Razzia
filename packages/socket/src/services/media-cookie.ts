import type { Context } from "hono"
import { setCookie } from "hono/cookie"
import { authMode } from "@razzia/socket/env"

export const setMediaCookie = (
  c: Context,
  token: string,
  expiresAt: number,
) => {
  if (authMode === "local") {
    setCookie(c, "razzia_media", token, {
      httpOnly: true,
      secure: process.env.AUTH_COOKIE_SECURE !== "false",
      sameSite: "Strict",
      path: "/media",
      maxAge: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    })
  }
}
