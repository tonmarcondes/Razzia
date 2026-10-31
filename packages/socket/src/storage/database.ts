import { SCHEMA_SQL, SCHEMA_VERSION } from "@razzia/socket/storage/schema"
import fs from "node:fs"
import path from "node:path"
import { backup, DatabaseSync } from "node:sqlite"

export const DATABASE_NAME = "accounts.sqlite"

export const resolveConfigDirectory = (input: string) => {
  if (!fs.lstatSync(input).isDirectory()) {
    throw new Error("Config path must be a real directory")
  }

  return fs.realpathSync(input)
}

export const requireDirectory = (directory: string) => {
  const absolute = path.resolve(directory)
  let current = path.parse(absolute).root

  for (const part of absolute.slice(current.length).split(path.sep)) {
    current = path.join(current, part)

    if (
      fs.lstatSync(current, { throwIfNoEntry: false }) &&
      !fs.lstatSync(current).isDirectory()
    ) {
      throw new Error("Storage paths must be real directories")
    }
  }

  return absolute
}

/** Backend-only storage. Opening this database does not enable account mode. */
export class LocalDatabase {
  readonly connection: DatabaseSync
  readonly filename: string

  constructor(configPath: string, options: { readOnly?: boolean } = {}) {
    const root = resolveConfigDirectory(configPath)
    const directory = requireDirectory(path.join(root, "accounts"))

    if (!options.readOnly) {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
      fs.chmodSync(directory, 0o700)
    }

    this.filename = path.join(directory, DATABASE_NAME)

    for (const file of [
      this.filename,
      `${this.filename}-wal`,
      `${this.filename}-shm`,
    ]) {
      if (
        fs.lstatSync(file, { throwIfNoEntry: false }) &&
        !fs.lstatSync(file).isFile()
      ) {
        throw new Error("Storage files must not be symlinks or special files")
      }
    }

    this.connection = new DatabaseSync(this.filename, {
      readOnly: options.readOnly ?? false,
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
      allowExtension: false,
    })

    try {
      this.connection.exec("PRAGMA busy_timeout = 5000")

      if (!options.readOnly) {
        fs.chmodSync(this.filename, 0o600)
        this.connection.exec(
          "PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL",
        )
        this.migrate()
      } else if (this.version() !== SCHEMA_VERSION) {
        throw new Error("Unsupported account database schema")
      }
    } catch (error) {
      this.connection.close()
      throw error
    }
  }

  version() {
    return this.connection.prepare("PRAGMA user_version").get()?.user_version
  }

  private migrate() {
    this.transaction(() => {
      const version = this.version()

      if (version === SCHEMA_VERSION) {
        return
      }

      if (version !== 0) {
        throw new Error("Unsupported account database schema")
      }

      this.connection.exec(SCHEMA_SQL)
      this.connection.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
    })
  }

  transaction<T>(operation: () => T): T {
    this.connection.exec("BEGIN IMMEDIATE")

    try {
      const result = operation()

      if (result instanceof Promise) {
        throw new Error("Storage transactions must be synchronous")
      }

      this.connection.exec("COMMIT")

      return result
    } catch (error) {
      this.connection.exec("ROLLBACK")
      throw error
    }
  }

  integrityCheck() {
    const result = this.connection.prepare("PRAGMA integrity_check").get()
    const foreignKeys = this.connection
      .prepare("PRAGMA foreign_key_check")
      .all()

    if (result?.integrity_check !== "ok" || foreignKeys.length) {
      throw new Error("Account database integrity check failed")
    }
  }

  async backupTo(destination: string) {
    const directory = requireDirectory(path.dirname(destination))

    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    const fd = fs.openSync(destination, "wx", 0o600)
    fs.closeSync(fd)

    try {
      await backup(this.connection, destination)
      const copy = new DatabaseSync(destination, { readOnly: true })

      try {
        if (
          copy.prepare("PRAGMA integrity_check").get()?.integrity_check !==
            "ok" ||
          copy.prepare("PRAGMA foreign_key_check").all().length
        ) {
          throw new Error("Backup integrity check failed")
        }
      } finally {
        copy.close()
      }

      fs.chmodSync(destination, 0o600)
    } catch (error) {
      fs.unlinkSync(destination)
      throw error
    }
  }

  close() {
    this.connection.close()
  }
}
