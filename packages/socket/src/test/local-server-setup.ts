import fs from "node:fs"
import path from "node:path"
import { LocalDatabase } from "@razzia/socket/storage/database"
import {
  inspectLegacy,
  migrateLegacy,
} from "@razzia/socket/storage/legacy-migration"
import { activateLocalStore } from "@razzia/socket/storage/activation"
import { Accounts } from "@razzia/socket/services/accounts"

const root = path.resolve(import.meta.dirname, "../../../e2e/.local-config")

if (process.env.CONFIG_PATH !== root) {
  throw new Error("Local E2E setup only supports its isolated test directory")
}

fs.rmSync(root, { recursive: true, force: true })
fs.mkdirSync(root, { recursive: true })
fs.cpSync(
  path.resolve(import.meta.dirname, "../../../e2e/fixtures/quizz"),
  path.join(root, "quizz"),
  { recursive: true },
)
const store = new LocalDatabase(root)

try {
  const inventory = inspectLegacy(root)
  migrateLegacy(store, root, inventory.manifestHash)
  await new Accounts(store).bootstrap(
    "admin",
    "Administrador de teste",
    "Temporary administrator test 20!",
  )
  activateLocalStore(store, root, inventory.manifestHash)
} finally {
  store.close()
}
