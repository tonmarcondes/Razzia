import { afterEach, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it("keeps legacy mode as the default", async () => {
  vi.stubEnv("AUTH_MODE", undefined)
  expect((await import("@razzia/socket/env")).authMode).toBe("legacy")
})

it("refuses premature local-mode activation instead of falling back to shared access", async () => {
  vi.stubEnv("AUTH_MODE", "local")
  await expect(import("@razzia/socket/env")).rejects.toThrow(
    "Local account mode is not available",
  )
})
