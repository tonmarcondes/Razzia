import type { Context } from "hono"
import fs from "node:fs"
import path from "node:path"
import type { BrandingTheme } from "@razzia/common/validators/branding"
import { renderBrandingMetadata } from "@razzia/common/branding-metadata"
import { readBranding } from "@razzia/socket/services/branding"

export const servePublicPage = (c: Context) => {
  let theme: BrandingTheme | null = null

  try {
    ;({ theme } = readBranding())
  } catch {
    /* Match the browser fallback for a malformed theme. */
  }

  const template = fs.readFileSync(
    process.env.WEB_INDEX_PATH?.length
      ? process.env.WEB_INDEX_PATH
      : path.resolve("../web/dist/index.html"),
    "utf8",
  )
  c.header("Cache-Control", "no-store")

  return c.html(
    renderBrandingMetadata(
      template,
      theme,
      process.env.PUBLIC_ORIGIN?.length
        ? process.env.PUBLIC_ORIGIN
        : new URL(c.req.url).origin,
    ),
  )
}
