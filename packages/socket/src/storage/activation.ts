import type { LocalDatabase } from "@razzia/socket/storage/database"
import { inspectLegacy } from "@razzia/socket/storage/legacy-migration"
import { ACCEPTED_MEDIA_TYPES } from "@razzia/common/constants"
import path from "node:path"

/** Offline cutover only, after stopping the legacy service and verifying a backup. */
export const activateLocalStore = (
  store: LocalDatabase,
  configPath: string,
  expectedManifest: string,
) => {
  const inventory = inspectLegacy(configPath),
    db = store.connection

  if (inventory.errors.length || inventory.manifestHash !== expectedManifest) {
    throw new Error("Legacy inventory changed or has errors")
  }

  if (
    db.prepare("SELECT value FROM metadata WHERE key='legacy-import-v1'").get()
      ?.value !== expectedManifest
  ) {
    throw new Error("Migration manifest does not match source")
  }

  if (
    db
      .prepare("SELECT value FROM metadata WHERE key='bootstrap-complete'")
      .get()?.value !== "true"
  ) {
    throw new Error("Bootstrap is incomplete")
  }

  if (
    !db
      .prepare(
        "SELECT id FROM users WHERE role='admin' AND active=1 AND password_hash IS NOT NULL",
      )
      .get()
  ) {
    throw new Error("No active administrator")
  }

  const extensions = new Set<string>(
    Object.values(ACCEPTED_MEDIA_TYPES).map((value) => value.ext),
  )

  if (
    inventory.files.some(
      (file) => file.kind === "media" && !extensions.has(path.extname(file.id)),
    )
  ) {
    throw new Error("Unsupported legacy media requires classification")
  }

  store.transaction(() => {
    if (
      db
        .prepare("SELECT value FROM metadata WHERE key='local-mode-ready'")
        .get()?.value === "true"
    ) {
      throw new Error("Local mode already activated")
    }

    db.prepare("UPDATE media SET classification='private'").run()
    db.prepare(
      "UPDATE metadata SET value='true' WHERE key='local-mode-ready'",
    ).run()
    db.prepare(
      "INSERT INTO audit_events (actor_id,action,resource_id,created_at) SELECT id,'local.activate',?,? FROM users WHERE role='admin' AND active=1 LIMIT 1",
    ).run(expectedManifest, new Date().toISOString())
    store.integrityCheck()
  })

  return { activated: true, manifestHash: expectedManifest }
}
