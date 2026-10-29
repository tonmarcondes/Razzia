import {
  brandingSchema,
  brandingUpdateValidator,
  BRANDING_ASSET_MAX_SIZE,
} from "@razzia/common/validators/branding"
import { getPath } from "@razzia/socket/services/config"
import {
  DomainError,
  invalidInput,
  serverError,
  unsupportedMediaType,
} from "@razzia/socket/services/errors"
import { createHash, randomUUID } from "crypto"
import { fileTypeFromBuffer } from "file-type"
import fs from "fs"
import { StatusCodes } from "http-status-codes"
import { join } from "path"

const directory = () => {
  const dir = getPath("branding")

  if (fs.existsSync(dir) && !fs.lstatSync(dir).isDirectory()) {
    throw serverError("errors:branding.failedToSave")
  }

  return dir
}
const themePath = () => join(directory(), "theme.json")
const rawTheme = () => {
  const path = themePath()

  if (!fs.existsSync(path)) {
    return ""
  }

  if (!fs.lstatSync(path).isFile()) {
    throw serverError("errors:branding.failedToSave")
  }

  return fs.readFileSync(path, "utf8")
}

export const readBranding = () => {
  const raw = rawTheme()
  const revision = createHash("sha256").update(raw).digest("hex")

  if (!raw) {
    return { theme: {}, revision }
  }

  try {
    return { theme: brandingSchema.parse(JSON.parse(raw)), revision }
  } catch {
    throw serverError("errors:branding.failedToRead")
  }
}

const assertRevision = (revision: string) => {
  if (readBranding().revision !== revision) {
    throw new DomainError("errors:branding.conflict", StatusCodes.CONFLICT)
  }
}

export const writeBranding = (theme: unknown, revision: string) => {
  const parsed = brandingUpdateValidator.safeParse(theme)

  if (!parsed.success) {
    throw invalidInput("errors:branding.invalidTheme")
  }

  assertRevision(revision)
  const dir = directory()
  fs.mkdirSync(dir, { recursive: true })
  const temp = join(dir, `.theme-${randomUUID()}.tmp`)

  try {
    fs.writeFileSync(temp, `${JSON.stringify(parsed.data, null, 2)}\n`, {
      flag: "wx",
    })
    fs.renameSync(temp, themePath())
  } finally {
    if (fs.existsSync(temp)) {
      fs.unlinkSync(temp)
    }
  }

  return readBranding()
}

export const resetBranding = (revision: string) => {
  assertRevision(revision)

  if (fs.existsSync(themePath())) {
    fs.unlinkSync(themePath())
  }
  // Retain assets: already-open games may still reference them.
}

export const uploadBrandingAsset = async (file: File) => {
  if (!file.size || file.size > BRANDING_ASSET_MAX_SIZE) {
    throw invalidInput("errors:branding.invalidAsset")
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const detected = await fileTypeFromBuffer(buffer)

  if (
    !detected ||
    ![
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ].includes(detected.mime)
  ) {
    throw unsupportedMediaType("errors:branding.invalidAsset")
  }

  const dir = directory()
  fs.mkdirSync(dir, { recursive: true })
  const name = `asset-${randomUUID()}.${detected.ext}`
  fs.writeFileSync(join(dir, name), buffer, { flag: "wx" })

  return { url: `/branding/${name}` }
}
