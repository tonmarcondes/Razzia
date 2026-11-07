import type { BrandingTheme } from "./validators/branding"

export const brandingMetadata = (
  theme: BrandingTheme | null,
  origin: string,
) => {
  const base = new URL(origin)

  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  ) {
    throw new Error("Invalid public origin")
  }

  const url = `${base.origin}/`
  const suppliedTitle = theme?.appName?.trim()
  const title = suppliedTitle?.length ? suppliedTitle : "Razzia"
  let image = new URL("/icon.svg", url).href

  try {
    const favicon = new URL(
      theme?.favicon?.length ? theme.favicon : "/icon.svg",
      url,
    )

    if (
      ["http:", "https:"].includes(favicon.protocol) &&
      !favicon.username &&
      !favicon.password
    ) {
      image = favicon.href
    }
  } catch {
    /* Use the bundled favicon for invalid legacy references. */
  }

  return { title, image, url }
}

const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/gu, (char) => htmlEntities[char] ?? char)

export const renderBrandingMetadata = (
  html: string,
  theme: BrandingTheme | null,
  origin: string,
) => {
  const { title, image, url } = brandingMetadata(theme, origin)
  const values: Record<string, string> = {
    "og:title": title,
    "og:image": image,
    "og:type": "website",
    "og:url": url,
  }
  let result = html.replace(
    /<title>[^<]*<\/title>/u,
    () => `<title>${escapeHtml(title)}</title>`,
  )
  for (const [property, content] of Object.entries(values)) {
    const tag = `<meta property="${property}" content="${escapeHtml(content)}" />`
    const pattern = new RegExp(
      `<meta\\s+property="${property}"\\s+content="[^"]*"\\s*\\/?>`,
      "u",
    )
    result = pattern.test(result)
      ? result.replace(pattern, () => tag)
      : result.replace("</head>", () => `${tag}\n</head>`)
  }

  return result.replace(
    /<link\b[^>]*\bid="favicon"[^>]*>/u,
    () => `<link id="favicon" rel="icon" href="${escapeHtml(image)}" />`,
  )
}
