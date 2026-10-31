import { getPath } from "@razzia/socket/services/config"
import { authMode } from "@razzia/socket/env"
import { verifyToken } from "@razzia/socket/services/auth"
import {
  localResources,
  mediaMimeByExtension,
} from "@razzia/socket/services/local-resources"
import Registry from "@razzia/socket/services/registry"
import type { Context } from "hono"
import { getCookie } from "hono/cookie"
import fs from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"

export const serveTrainingMedia = async (c: Context) => {
  const name = c.req.param("name")
  const missing = () => c.json({ error: "errors:media.notFound" }, 404)

  if (!name || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/u.test(name)) {
    return missing()
  }

  if (authMode === "local") {
    c.header("Cache-Control", "private, no-store")
    c.header("Vary", "Cookie")

    try {
      const claims = await verifyToken(getCookie(c, "razzia_media") ?? "")
      const allowed =
        claims.role === "manager"
          ? localResources.canReadMedia(claims, name) ||
            Registry.getInstance().canReadMedia(claims.sub, name, true) ||
            Registry.getInstance().canReadMedia(claims.sub, name)
          : Registry.getInstance().canReadMedia(claims.sub, name)

      if (!allowed) {
        return missing()
      }
    } catch {
      return missing()
    }
  }

  const directory = getPath("media"),
    filename = path.join(directory, name)

  if (
    !fs.lstatSync(directory, { throwIfNoEntry: false })?.isDirectory() ||
    !fs.lstatSync(filename, { throwIfNoEntry: false })?.isFile()
  ) {
    return missing()
  }

  const { size } = fs.statSync(filename)
  c.header(
    "Content-Type",
    mediaMimeByExtension.get(path.extname(name)) ?? "application/octet-stream",
  )
  c.header("X-Content-Type-Options", "nosniff")
  c.header("Accept-Ranges", "bytes")
  let start = 0,
    end = size - 1,
    status: 200 | 206 = 200
  const range = c.req.header("Range")

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/u.exec(range)

    if (!match || (!match[1] && !match[2])) {
      c.header("Content-Range", `bytes */${size}`)

      return c.body(null, 416)
    }

    if (match[1]) {
      start = Number(match[1])
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
    } else {
      start = Math.max(0, size - Number(match[2]))
      end = size - 1
    }

    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= size
    ) {
      c.header("Content-Range", `bytes */${size}`)

      return c.body(null, 416)
    }

    status = 206
    c.header("Content-Range", `bytes ${start}-${end}/${size}`)
  }

  c.header("Content-Length", String(Math.max(0, end - start + 1)))

  if (!size) {
    return c.body(null, 200)
  }

  return c.body(
    Readable.toWeb(
      fs.createReadStream(filename, { start, end }),
    ) as ReadableStream,
    status,
  )
}
