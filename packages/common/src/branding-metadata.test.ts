import { describe, expect, it } from "vitest"
import { brandingMetadata, renderBrandingMetadata } from "./branding-metadata"
const html =
  '<html><head><title>Razzia</title><link id="favicon" rel="icon" href="/icon.svg" /><meta property="og:title" content="Razzia" /><meta property="og:image" content="/icon.svg" /></head><body><script src="/assets/app.js"></script></body></html>'
describe("public branding metadata", () => {
  it("keeps the original identity without a theme", () => {
    expect(brandingMetadata(null, "https://quiz.example")).toEqual({
      title: "Razzia",
      image: "https://quiz.example/icon.svg",
      url: "https://quiz.example/",
    })
  })
  it("uses the favicon rather than the logo and resolves local assets against the public origin", () => {
    expect(
      brandingMetadata(
        {
          appName: "Training",
          favicon: "/branding/favicon.png",
          logo: "/branding/logo.png",
        },
        "https://quiz.example",
      ),
    ).toEqual({
      title: "Training",
      image: "https://quiz.example/branding/favicon.png",
      url: "https://quiz.example/",
    })
    expect(
      brandingMetadata(
        { favicon: "https://images.example/favicon.png" },
        "https://quiz.example",
      ).image,
    ).toBe("https://images.example/favicon.png")
  })
  it("rejects unsafe legacy favicon URLs without exposing credentials", () => {
    for (const favicon of [
      ["javascript", "alert(1)"].join(":"),
      "data:image/png;base64,AA",
      "https://user:password@images.example/a.png",
    ]) {
      expect(brandingMetadata({ favicon }, "https://quiz.example").image).toBe(
        "https://quiz.example/icon.svg",
      )
    }
  })
  it("escapes titles and URL attributes without evaluating replacement sequences or changing scripts", () => {
    const output = renderBrandingMetadata(
      html,
      {
        appName: 'Quiz "<>& $&',
        favicon: "https://images.example/i.png?a=1&b=2",
      },
      "https://quiz.example",
    )
    expect(output).toContain("<title>Quiz &quot;&lt;&gt;&amp; $&amp;</title>")
    expect(output).toContain(
      'property="og:title" content="Quiz &quot;&lt;&gt;&amp; $&amp;"',
    )
    expect(output).toContain("i.png?a=1&amp;b=2")
    expect(output).toContain('<script src="/assets/app.js"></script>')
    expect(output.match(/property="og:title"/g)).toHaveLength(1)
    expect(output).toContain('property="og:type" content="website"')
  })
})
