import { defineConfig } from "rolldown"

export default defineConfig({
  input: { index: "src/index.ts", "account-storage": "src/storage/cli.ts" },
  platform: "node",
  transform: {
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  },
  output: {
    dir: "dist",
    entryFileNames: "[name].cjs",
    chunkFileNames: "[name]-[hash].cjs",
    format: "cjs",
    minify: true,
    sourcemap: true,
  },
})
