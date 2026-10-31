import {
  parseLegacyQuiz,
  parseLegacyResult,
} from "@razzia/socket/storage/legacy-validation"
import {
  resolveConfigDirectory,
  type LocalDatabase,
} from "@razzia/socket/storage/database"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export const HOLDING_OWNER_ID = "legacy-holding-administrator"

const MIGRATION_KEY = "legacy-import-v1"
const MAX_FILE_BYTES = 64 * 1024 * 1024

export type LegacyKind = "quiz" | "result" | "media"

export interface MigrationIssue {
  path: string
  code: string
}

interface LegacyFile {
  path: string
  sha256: string
  kind: LegacyKind
  id: string
  payload?: string
  size: number
}

export interface MigrationInventory {
  files: LegacyFile[]
  errors: MigrationIssue[]
  warnings: MigrationIssue[]
  manifestHash: string
}

export const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex")

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

/** Read-only: never calls legacy getQuizz(), which assigns IDs on disk. */
export const inspectLegacy = (configPath: string): MigrationInventory => {
  const root = resolveConfigDirectory(configPath)
  const files: LegacyFile[] = []
  const errors: MigrationIssue[] = []
  const warnings: MigrationIssue[] = []
  const seen = new Set<string>()
  const titles = new Map<string, string>()

  for (const [directory, kind] of [
    ["quizz", "quiz"],
    ["results", "result"],
    ["media", "media"],
  ] as const) {
    const full = path.join(root, directory)
    const stat = fs.lstatSync(full, { throwIfNoEntry: false })

    if (!stat) {
      continue
    }

    if (!stat.isDirectory()) {
      errors.push({ path: directory, code: "unsafe-path" })

      continue
    }

    for (const name of fs.readdirSync(full).sort()) {
      const relative = `${directory}/${name}`
      const filename = path.join(full, name)
      const metadata = fs.lstatSync(filename)

      if (!metadata.isFile()) {
        errors.push({ path: relative, code: "unsafe-path" })

        continue
      }

      if (kind !== "media" && !name.endsWith(".json")) {
        warnings.push({ path: relative, code: "unrecognized-file" })

        continue
      }

      if (metadata.size > MAX_FILE_BYTES) {
        errors.push({ path: relative, code: "file-too-large" })

        continue
      }

      const raw = fs.readFileSync(filename)
      const hash = sha256(raw)

      if (kind === "media") {
        if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/u.test(name)) {
          errors.push({ path: relative, code: "unsupported-media-name" })

          continue
        }

        files.push({
          path: relative,
          sha256: hash,
          kind,
          id: name,
          size: raw.length,
        })

        continue
      }

      try {
        const data: unknown = JSON.parse(raw.toString("utf8"))

        if (!isRecord(data)) {
          throw new Error("invalid-record")
        }

        const { id: inputId, ...content } = data
        const id =
          inputId === undefined && kind === "quiz"
            ? `legacy-${sha256(relative).slice(0, 32)}`
            : inputId

        if (typeof id !== "string" || !id.length || id.length > 256) {
          throw new Error("invalid-id")
        }

        if (seen.has(`${kind}:${id}`)) {
          throw new Error("duplicate-id")
        }

        seen.add(`${kind}:${id}`)

        const payload =
          kind === "quiz" ? parseLegacyQuiz(content) : parseLegacyResult(data)
        const titleKey = `${kind}:${payload.subject.normalize("NFC").toLowerCase()}`

        if (titles.has(titleKey)) {
          warnings.push({ path: relative, code: "duplicate-title" })
        }

        titles.set(titleKey, relative)

        if (inputId === undefined) {
          warnings.push({ path: relative, code: "generated-id" })
        }

        files.push({
          path: relative,
          sha256: hash,
          kind,
          id,
          payload: JSON.stringify(payload),
          size: raw.length,
        })
      } catch (error) {
        const code =
          error instanceof Error &&
          ["unsupported-fields", "duplicate-id", "invalid-id"].includes(
            error.message,
          )
            ? error.message
            : "invalid-record"
        errors.push({ path: relative, code })
      }
    }
  }

  const mediaNames = new Set(
    files.filter((f) => f.kind === "media").map((f) => f.id),
  )

  for (const file of files.filter((f) => f.payload)) {
    try {
      for (const name of mediaReferences(file.payload ?? "{}")) {
        if (!mediaNames.has(name)) {
          errors.push({ path: file.path, code: "missing-media" })
        }
      }
    } catch {
      errors.push({ path: file.path, code: "unsupported-media-url" })
    }
  }

  return {
    files,
    errors,
    warnings,
    manifestHash: sha256(
      JSON.stringify(
        files.map(({ path: source, sha256: hash }) => [source, hash]),
      ),
    ),
  }
}

export const mediaReferences = (payload: string): string[] => {
  const data = JSON.parse(payload) as {
    questions?: Array<{ media?: { url: string } }>
  }

  return [
    ...new Set(
      (data.questions ?? []).flatMap((q) => {
        const url = q.media?.url

        if (!url?.startsWith("/media/")) {
          return []
        }

        const name = url.slice("/media/".length)

        if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/u.test(name)) {
          throw new Error("unsupported-media-url")
        }

        return [name]
      }),
    ),
  ]
}

export const migrateLegacy = (
  store: LocalDatabase,
  configPath: string,
  expectedManifest: string,
) => {
  const inventory = inspectLegacy(configPath)

  if (inventory.errors.length) {
    throw new Error("Legacy inventory has blocking errors")
  }

  if (inventory.manifestHash !== expectedManifest) {
    throw new Error("Legacy files changed after review")
  }

  return store.transaction(() => {
    const db = store.connection
    const existing = db
      .prepare("SELECT value FROM metadata WHERE key = ?")
      .get(MIGRATION_KEY)

    if (existing) {
      if (existing.value !== inventory.manifestHash) {
        throw new Error("Legacy migration already applied to different data")
      }

      return { imported: false, manifestHash: inventory.manifestHash }
    }

    for (const table of [
      "users",
      "quizzes",
      "results",
      "media",
      "sessions",
      "game_runs",
    ]) {
      if (
        db.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.count !== 0
      ) {
        throw new Error("Legacy migration requires an empty account store")
      }
    }

    const now = new Date().toISOString()

    db.prepare(
      "INSERT INTO users (id, login, display_name, role, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?)",
    ).run(
      HOLDING_OWNER_ID,
      "legacy-admin",
      "Legacy holding administrator",
      now,
      now,
    )

    for (const file of inventory.files) {
      db.prepare(
        "INSERT INTO migration_files (path, sha256, kind, resource_id) VALUES (?, ?, ?, ?)",
      ).run(file.path, file.sha256, file.kind, file.id)

      if (file.kind === "quiz") {
        db.prepare(
          "INSERT INTO quizzes (id, owner_id, current_revision, created_at, updated_at) VALUES (?, ?, 1, ?, ?)",
        ).run(file.id, HOLDING_OWNER_ID, now, now)
        db.prepare(
          "INSERT INTO quiz_revisions (quiz_id, revision, payload, sha256, author_id, created_at) VALUES (?, 1, ?, ?, ?, ?)",
        ).run(
          file.id,
          file.payload ?? "",
          sha256(file.payload ?? ""),
          HOLDING_OWNER_ID,
          now,
        )
      } else if (file.kind === "result") {
        db.prepare(
          "INSERT INTO results (id, owner_id, payload, created_at) VALUES (?, ?, ?, ?)",
        ).run(file.id, HOLDING_OWNER_ID, file.payload ?? "", now)
      } else {
        db.prepare(
          "INSERT INTO media (name, owner_id, sha256, size, created_at) VALUES (?, ?, ?, ?, ?)",
        ).run(file.id, HOLDING_OWNER_ID, file.sha256, file.size, now)
      }
    }

    for (const file of inventory.files.filter((f) => f.payload)) {
      for (const name of mediaReferences(file.payload ?? "{}")) {
        db.prepare(
          "INSERT INTO media_references (media_name, resource_kind, resource_id, revision) VALUES (?, ?, ?, ?)",
        ).run(
          name,
          file.kind === "quiz" ? "quiz_revision" : "result",
          file.id,
          file.kind === "quiz" ? 1 : 0,
        )
      }
    }

    const after = inspectLegacy(configPath)

    if (after.errors.length || after.manifestHash !== inventory.manifestHash) {
      throw new Error("Legacy files changed during migration")
    }

    db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)").run(
      MIGRATION_KEY,
      inventory.manifestHash,
    )
    db.prepare(
      "INSERT INTO metadata (key, value) VALUES ('local-mode-ready', 'false')",
    ).run()
    db.prepare(
      "INSERT INTO audit_events (actor_id, action, resource_id, created_at) VALUES (?, 'legacy.import', ?, ?)",
    ).run(HOLDING_OWNER_ID, inventory.manifestHash, now)
    store.integrityCheck()

    return { imported: true, manifestHash: inventory.manifestHash }
  })
}
