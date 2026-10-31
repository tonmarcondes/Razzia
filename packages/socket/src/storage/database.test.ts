import { LocalDatabase } from "@razzia/socket/storage/database"
import {
  HOLDING_OWNER_ID,
  inspectLegacy,
  migrateLegacy,
} from "@razzia/socket/storage/legacy-migration"
import { createQuestion, createQuizz } from "@razzia/socket/test/fixtures"
import fs from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { parseLegacyQuiz } from "@razzia/socket/storage/legacy-validation"
import { DatabaseSync } from "node:sqlite"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

let root = ""
const stores: LocalDatabase[] = []
const open = (directory = root) => {
  const store = new LocalDatabase(directory)
  stores.push(store)

  return store
}
const write = (name: string, data: unknown) => {
  const file = path.join(root, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data))
}
const seed = () => {
  write("quizz/example.json", {
    id: "quiz-1",
    ...createQuizz([createQuestion()]),
  })
  write("results/example.json", {
    id: "result-1",
    subject: "Result",
    date: "2026-10-31T00:00:00.000Z",
    players: [],
    questions: [],
  })
}
beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(tmpdir(), "razzia-storage-")))
})
afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close()
  }
  fs.rmSync(root, { recursive: true, force: true })
})

describe("account storage foundation", () => {
  it("creates and reopens the schema with restrictive permissions and foreign keys", () => {
    const a = open()
    const b = open()
    expect(b.version()).toBe(1)
    expect(fs.statSync(a.filename).mode & 0o777).toBe(0o600)
    expect(fs.statSync(path.dirname(a.filename)).mode & 0o777).toBe(0o700)
    expect(
      a.connection.prepare("PRAGMA foreign_keys").get()?.foreign_keys,
    ).toBe(1)
    expect(
      a.connection.prepare("PRAGMA journal_mode").get()?.journal_mode,
    ).toBe("wal")
    expect(a.connection.prepare("PRAGMA busy_timeout").get()?.timeout).toBe(
      5000,
    )
    expect(() =>
      a.connection
        .prepare(
          "INSERT INTO sessions VALUES ('x', 'missing', 'client', 1, 2, NULL)",
        )
        .run(),
    ).toThrow()
    a.integrityCheck()
  })
  it("rolls back writes when a transaction fails", () => {
    const store = open()
    const operation = () => {
      store.connection
        .prepare("INSERT INTO metadata VALUES ('test','value')")
        .run()
      throw Error("test")
    }
    expect(() => store.transaction(operation)).toThrow("test")
    expect(store.connection.prepare("SELECT * FROM metadata").all()).toEqual([])
  })
  it("refuses unknown schema versions without rewriting them", () => {
    const store = open()
    store.connection.exec("PRAGMA user_version = 999")
    expect(() => new LocalDatabase(root)).toThrow(
      "Unsupported account database schema",
    )
    expect(store.version()).toBe(999)
  })
  it("restores an isolated config with the matching media and every stored record", async () => {
    seed()
    const question = createQuestion({
      media: { type: "image", url: "/media/reference.png" },
    })
    write("quizz/reference.json", {
      id: "reference-quiz",
      ...createQuizz([question]),
    })
    fs.mkdirSync(path.join(root, "media"))
    fs.writeFileSync(path.join(root, "media/reference.png"), "synthetic asset")
    const store = open()
    const inventory = inspectLegacy(root)
    migrateLegacy(store, root, inventory.manifestHash)
    const restoredRoot = path.join(root, "restored")
    fs.mkdirSync(path.join(restoredRoot, "accounts"), { recursive: true })
    await store.backupTo(path.join(restoredRoot, "accounts/accounts.sqlite"))
    fs.cpSync(path.join(root, "media"), path.join(restoredRoot, "media"), {
      recursive: true,
    })
    const restored = open(restoredRoot)
    restored.integrityCheck()
    for (const table of [
      "users",
      "quizzes",
      "quiz_revisions",
      "results",
      "media",
      "media_references",
      "migration_files",
      "metadata",
      "audit_events",
    ]) {
      expect(
        restored.connection.prepare(`SELECT * FROM ${table}`).all(),
      ).toEqual(store.connection.prepare(`SELECT * FROM ${table}`).all())
    }
    expect(
      fs.readFileSync(path.join(restoredRoot, "media/reference.png")),
    ).toEqual(fs.readFileSync(path.join(root, "media/reference.png")))
  })
  it("refuses symlink database files and directories, including dangling links", () => {
    const accounts = path.join(root, "accounts")
    fs.mkdirSync(accounts)
    fs.symlinkSync(
      path.join(root, "outside.sqlite"),
      path.join(accounts, "accounts.sqlite"),
    )
    expect(() => new LocalDatabase(root)).toThrow("Storage files")
    expect(fs.existsSync(path.join(root, "outside.sqlite"))).toBe(false)
    fs.rmSync(accounts, { recursive: true })
    fs.symlinkSync(tmpdir(), accounts)
    expect(() => new LocalDatabase(root)).toThrow("real directories")
  })
  it("backs up committed WAL writes and restores complete records without overwriting a file", async () => {
    seed()
    const store = open()
    migrateLegacy(store, root, inspectLegacy(root).manifestHash)
    store.connection
      .prepare("INSERT INTO metadata VALUES ('after-migration', 'retained')")
      .run()
    const file = path.join(root, "backups", "copy.sqlite")
    await store.backupTo(file)
    expect(fs.statSync(file).mode & 0o777).toBe(0o600)
    await expect(store.backupTo(file)).rejects.toThrow()
    const restored = new DatabaseSync(file, { readOnly: true })

    try {
      expect(
        restored
          .prepare("SELECT value FROM metadata WHERE key='after-migration'")
          .get()?.value,
      ).toBe("retained")
      expect(restored.prepare("SELECT id FROM results").get()?.id).toBe(
        "result-1",
      )
      expect(
        restored.prepare("SELECT owner_id FROM quizzes").get()?.owner_id,
      ).toBe(HOLDING_OWNER_ID)
      expect(
        restored.prepare("PRAGMA integrity_check").get()?.integrity_check,
      ).toBe("ok")
    } finally {
      restored.close()
    }
  })
})

describe("legacy migration", () => {
  it("reports prototype-named unknown fields rather than silently dropping them", () => {
    const data = JSON.parse(
      JSON.stringify(createQuizz([createQuestion()])).replace(
        '"subject":',
        '"__proto__":"retained-input","subject":',
      ),
    ) as unknown
    expect(() => parseLegacyQuiz(data)).toThrow("unsupported-fields")
  })

  it("does not create a database or rewrite IDs during inspection", () => {
    write("quizz/legacy.json", {
      subject: "Legacy",
      questions: [
        {
          question: "Q",
          answers: ["A", "B"],
          solutions: 0,
          cooldown: 5,
          time: 20,
        },
      ],
    })
    const before = fs.readFileSync(path.join(root, "quizz/legacy.json"))
    const a = inspectLegacy(root)
    const b = inspectLegacy(root)
    expect(a.errors).toEqual([])
    expect(a.manifestHash).toBe(b.manifestHash)
    expect(a.files[0].id).toBe(b.files[0].id)
    expect(a.warnings).toContainEqual({
      path: "quizz/legacy.json",
      code: "generated-id",
    })
    expect(fs.readFileSync(path.join(root, "quizz/legacy.json"))).toEqual(
      before,
    )
    expect(fs.existsSync(path.join(root, "accounts"))).toBe(false)
  })
  it("preserves IDs, payloads and source hashes and keeps imported content private and unavailable", () => {
    seed()
    const inventory = inspectLegacy(root)
    const store = open()
    expect(migrateLegacy(store, root, inventory.manifestHash).imported).toBe(
      true,
    )
    expect(migrateLegacy(store, root, inventory.manifestHash).imported).toBe(
      false,
    )
    expect(inspectLegacy(root).manifestHash).toBe(inventory.manifestHash)
    expect(
      store.connection
        .prepare("SELECT id, owner_id, visibility FROM quizzes")
        .get(),
    ).toMatchObject({
      id: "quiz-1",
      owner_id: HOLDING_OWNER_ID,
      visibility: "private",
    })
    expect(
      store.connection.prepare("SELECT active, password_hash FROM users").get(),
    ).toMatchObject({ active: 0, password_hash: null })
    expect(
      store.connection
        .prepare("SELECT value FROM metadata WHERE key='local-mode-ready'")
        .get()?.value,
    ).toBe("false")
    expect(
      store.connection
        .prepare("SELECT count(*) AS count FROM migration_files")
        .get()?.count,
    ).toBe(2)
    const original = JSON.parse(
      inventory.files.find((f) => f.kind === "quiz")?.payload ?? "{}",
    ) as unknown
    const record = store.connection
      .prepare("SELECT payload FROM quiz_revisions")
      .get()
    expect(JSON.parse(String(record?.payload))).toEqual(original)
    expect(() =>
      store.connection.prepare("UPDATE quiz_revisions SET payload='{}'").run(),
    ).toThrow("immutable")
    expect(() =>
      store.connection.prepare("UPDATE results SET payload='{}'").run(),
    ).toThrow("immutable")
  })
  it("records all media references without publishing or deleting assets", () => {
    const q = createQuestion({
      media: { type: "image", url: "/media/asset.png" },
    })
    write("quizz/media.json", { id: "media-quiz", ...createQuizz([q]) })
    fs.mkdirSync(path.join(root, "media"))
    fs.writeFileSync(path.join(root, "media/asset.png"), "synthetic")
    const store = open()
    migrateLegacy(store, root, inspectLegacy(root).manifestHash)
    expect(
      store.connection.prepare("SELECT classification FROM media").get()
        ?.classification,
    ).toBe("holding")
    expect(
      store.connection
        .prepare("SELECT media_name, revision FROM media_references")
        .get(),
    ).toMatchObject({ media_name: "asset.png", revision: 1 })
    expect(fs.readFileSync(path.join(root, "media/asset.png"), "utf8")).toBe(
      "synthetic",
    )
  })
  it("reports duplicates, unknown fields, malformed data and missing assets instead of dropping them", () => {
    seed()
    write("quizz/duplicate.json", {
      id: "quiz-1",
      ...createQuizz([createQuestion()]),
    })
    write("quizz/unknown.json", {
      id: "unknown",
      ...createQuizz([createQuestion()]),
      unsupported: "do not discard",
    })
    write("quizz/missing.json", {
      id: "missing",
      ...createQuizz([createQuestion({ media: { url: "/media/absent.png" } })]),
    })
    fs.writeFileSync(path.join(root, "quizz/broken.json"), "{")
    const inventory = inspectLegacy(root)
    expect(inventory.errors.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "duplicate-id",
        "unsupported-fields",
        "missing-media",
        "invalid-record",
      ]),
    )
    const store = open()
    expect(() => migrateLegacy(store, root, inventory.manifestHash)).toThrow(
      "blocking errors",
    )
    expect(store.connection.prepare("SELECT * FROM users").all()).toEqual([])
  })
  it("preserves equal titles as distinct quiz IDs and reports the conflict", () => {
    seed()
    write("quizz/second.json", {
      id: "second",
      ...createQuizz([createQuestion()]),
    })
    const inventory = inspectLegacy(root)
    expect(inventory.warnings.some((i) => i.code === "duplicate-title")).toBe(
      true,
    )
    const store = open()
    migrateLegacy(store, root, inventory.manifestHash)
    expect(
      store.connection.prepare("SELECT count(*) AS count FROM quizzes").get()
        ?.count,
    ).toBe(2)
  })
  it("refuses a changed manifest and rolls back a failure halfway through import", () => {
    seed()
    const inventory = inspectLegacy(root)
    const store = open()
    expect(() => migrateLegacy(store, root, "incorrect")).toThrow(
      "changed after review",
    )
    store.connection.exec(
      "CREATE TRIGGER fail_results BEFORE INSERT ON results BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END",
    )
    expect(() => migrateLegacy(store, root, inventory.manifestHash)).toThrow(
      "synthetic failure",
    )
    expect(store.connection.prepare("SELECT * FROM users").all()).toEqual([])
    expect(store.connection.prepare("SELECT * FROM quizzes").all()).toEqual([])
    expect(
      store.connection.prepare("SELECT * FROM migration_files").all(),
    ).toEqual([])
    expect(inspectLegacy(root).manifestHash).toBe(inventory.manifestHash)
  })
  it("refuses symlink sources without reading their target", () => {
    fs.mkdirSync(path.join(root, "quizz"))
    fs.symlinkSync("/etc/passwd", path.join(root, "quizz/escape.json"))
    expect(inspectLegacy(root).errors).toContainEqual({
      path: "quizz/escape.json",
      code: "unsafe-path",
    })
  })
})
