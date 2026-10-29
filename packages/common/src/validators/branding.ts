import z from "zod"

export const BRANDING_ASSET_MAX_SIZE = 5 * 1024 * 1024

export const BACKGROUND_STAGES = ["home", "lobby", "game", "results"] as const

export type BackgroundStage = (typeof BACKGROUND_STAGES)[number]

// Keep reading the existing file format, including externally configured fonts.
export const brandingSchema = z.object({
  appName: z.string().optional(),
  colors: z.record(z.string(), z.string()).optional(),
  answerColors: z.array(z.string()).optional(),
  font: z.object({ family: z.string(), url: z.string().optional() }).optional(),
  logo: z.string().optional(),
  favicon: z.string().optional(),
  background: z.string().optional(),
  backgrounds: z
    .object({
      home: z.string().optional(),
      lobby: z.string().optional(),
      game: z.string().optional(),
      results: z.string().optional(),
    })
    .optional(),
})

export type BrandingTheme = z.infer<typeof brandingSchema>

const imageUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    if (/^\/(?:branding|media)\/[A-Za-z0-9][A-Za-z0-9_.-]*$/u.test(value)) {
      return !value.includes("..")
    }

    try {
      const url = new URL(value)

      return url.protocol === "https:" && !url.username && !url.password
    } catch {
      return false
    }
  }, "errors:branding.invalidTheme")
const color = z
  .string()
  .max(160)
  .regex(
    /^(?:#[\da-f]{3,8}|[a-z]+|var\(--color-[a-z\d-]+\)|(?:rgb|rgba|hsl|hsla|oklch|oklab)\([\d.,%/ +-]+\))$/iu,
    "errors:branding.invalidTheme",
  )
const colorKey = z
  .string()
  .max(64)
  .regex(/^[a-z][a-z\d-]*$/u)

export const brandingUpdateValidator = z
  .object({
    appName: z.string().trim().min(1).max(80).optional(),
    colors: z.record(colorKey, color).optional(),
    answerColors: z.array(color).max(4).optional(),
    font: z
      .object({
        family: z
          .string()
          .max(100)
          .regex(/^[\p{L}\p{N} ,_-]+$/u),
        url: z
          .url()
          .refine((v) => {
            const u = new URL(v)

            return u.protocol === "https:" && !u.username && !u.password
          })
          .optional(),
      })
      .strict()
      .optional(),
    logo: imageUrl.optional(),
    favicon: imageUrl.optional(),
    background: imageUrl.optional(),
    backgrounds: z
      .object({
        home: imageUrl.optional(),
        lobby: imageUrl.optional(),
        game: imageUrl.optional(),
        results: imageUrl.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export const brandingWriteValidator = z
  .object({
    theme: brandingUpdateValidator,
    revision: z.string().regex(/^[a-f\d]{64}$/u),
  })
  .strict()

export const brandingResetValidator = z
  .object({ revision: z.string().regex(/^[a-f\d]{64}$/u) })
  .strict()

export const brandingUploadValidator = z.object({
  file: z
    .instanceof(File)
    .refine(
      (f) => f.size > 0 && f.size <= BRANDING_ASSET_MAX_SIZE,
      "errors:branding.invalidAsset",
    ),
})
