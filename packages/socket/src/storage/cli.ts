import { LocalDatabase } from "@razzia/socket/storage/database"
import {
  inspectLegacy,
  migrateLegacy,
} from "@razzia/socket/storage/legacy-migration"
import path from "node:path"

import { Accounts } from "@razzia/socket/services/accounts"
import fs from "node:fs"

import {
  activateLocalStore,
  isLocalStoreReady,
} from "@razzia/socket/storage/activation"

const main = async () => {
  const [command, configArgument, argument] = process.argv.slice(2)

  if (
    !command ||
    !configArgument ||
    ![
      "inspect",
      "migrate",
      "backup",
      "check",
      "bootstrap",
      "activate",
    ].includes(command)
  ) {
    throw new Error(
      "Usage: account-storage <inspect|migrate|backup|check> <config-directory> [manifest-hash|backup-file]",
    )
  }

  const configPath = path.resolve(configArgument)

  if (command === "inspect" || command === "migrate") {
    const inventory = inspectLegacy(configPath)
    const report = {
      manifestHash: inventory.manifestHash,
      counts: Object.fromEntries(
        ["quiz", "result", "media"].map((kind) => [
          kind,
          inventory.files.filter((f) => f.kind === kind).length,
        ]),
      ),
      errors: inventory.errors,
      warnings: inventory.warnings,
    }

    if (command === "inspect") {
      console.log(JSON.stringify(report, null, 2))

      if (inventory.errors.length) {
        process.exitCode = 1
      }

      return
    }

    if (
      !argument ||
      argument !== inventory.manifestHash ||
      inventory.errors.length
    ) {
      throw new Error(
        "Run inspect and resolve errors, then supply its exact manifest hash",
      )
    }
  }

  const store = new LocalDatabase(configPath, {
    readOnly:
      command !== "migrate" &&
      command !== "bootstrap" &&
      command !== "activate",
  })

  try {
    if (command === "activate") {
      if (!argument) {
        throw new Error("Reviewed migration hash required")
      }

      console.log(
        JSON.stringify(activateLocalStore(store, configPath, argument)),
      )
    } else if (command === "bootstrap") {
      if (!argument) {
        throw new Error("Administrator login required")
      }

      const input = JSON.parse(fs.readFileSync(0, "utf8")) as {
        displayName: string
        password: string
      }
      const user = await new Accounts(store).bootstrap(
        argument,
        input.displayName,
        input.password,
      )
      console.log(
        JSON.stringify({
          id: user.id,
          login: user.login,
          mustReset: user.mustReset,
        }),
      )
    } else if (command === "migrate") {
      console.log(JSON.stringify(migrateLegacy(store, configPath, argument)))
    } else if (command === "backup") {
      if (!argument) {
        throw new Error("A new backup file path is required")
      }

      await store.backupTo(path.resolve(argument))
      console.log(JSON.stringify({ backupVerified: true }))
    } else {
      store.integrityCheck()
      console.log(
        JSON.stringify({
          integrity: "ok",
          schemaVersion: store.version(),
          localModeReady: isLocalStoreReady(store),
        }),
      )
    }
  } finally {
    store.close()
  }
}

void main().catch(() => {
  // Migration inputs can contain training material: never dump Zod or SQL errors.
  console.error(
    "Account storage operation failed. Check the command, inventory, schema and filesystem permissions; source files were not modified.",
  )
  process.exitCode = 1
})
