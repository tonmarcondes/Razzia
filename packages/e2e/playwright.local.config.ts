import { defineConfig, devices } from "@playwright/test"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "../..")
const CONFIG_PATH = path.join(import.meta.dirname, ".local-config")
const env = {
  CONFIG_PATH,
  AUTH_MODE: "local",
  AUTH_COOKIE_SECURE: "false",
  JWT_SECRET: "synthetic-local-e2e-secret-at-least-32-characters",
  SOCKET_PORT: "3101",
  WEB_PORT: "3100",
  GAME_SPEED: "1",
}

export default defineConfig({
  testDir: "local-tests",
  timeout: 120000,
  expect: { timeout: 20000 },
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3100",
    locale: "pt-BR",
    trace: "retain-on-failure",
  },
  projects: [{ name: "local-accounts", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "node --import tsx src/test/local-server-setup.ts && node --import tsx src/index.ts",
      cwd: path.join(root, "packages/socket"),
      url: "http://localhost:3101/api/health",
      reuseExistingServer: false,
      env,
    },
    {
      command: "node node_modules/vite/bin/vite.js preview --strictPort",
      cwd: path.join(root, "packages/web"),
      url: "http://localhost:3100",
      reuseExistingServer: false,
      env,
    },
  ],
})
