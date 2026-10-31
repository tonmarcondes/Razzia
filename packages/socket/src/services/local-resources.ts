import { ACCEPTED_MEDIA_TYPES } from "@razzia/common/constants"
import type { SessionClaims } from "@razzia/common/types/auth"
import type {
  GameResult,
  GameResultMeta,
  QuizzWithId,
  UploadedMedia,
} from "@razzia/common/types/game"
import {
  quizzValidator,
  type QuizzValidated,
} from "@razzia/common/validators/quizz"
import { getAccounts } from "@razzia/socket/services/accounts"
import {
  invalidInput,
  notFound,
  DomainError,
} from "@razzia/socket/services/errors"
import { getPath } from "@razzia/socket/services/config"
import { listMedia, saveMedia } from "@razzia/socket/services/media"
import {
  mediaReferences,
  sha256,
} from "@razzia/socket/storage/legacy-migration"
import { parseLegacyResult } from "@razzia/socket/storage/legacy-validation"
import fs from "node:fs"
import { randomUUID } from "node:crypto"
import path from "node:path"

export const localResources = {
  principal(claims: SessionClaims) {
    const user = getAccounts().current(claims)

    if (user.mustReset) {
      throw new DomainError("errors:accounts.changeRequired", 403)
    }

    return user
  },
  listQuizzes(claims: SessionClaims) {
    const user = this.principal(claims),
      a = getAccounts()

    if (user.role === "admin") {
      a.audit(user.id, "quiz.list", "all")
    }

    return a.db
      .prepare(
        "SELECT q.id,r.payload FROM quizzes q JOIN quiz_revisions r ON r.quiz_id=q.id AND r.revision=q.current_revision WHERE q.archived_at IS NULL AND (q.owner_id=? OR ?='admin') ORDER BY json_extract(r.payload,'$.subject')",
      )
      .all(user.id, user.role)
      .map((row) => ({
        id: String(row.id),
        subject: (JSON.parse(String(row.payload)) as QuizzValidated).subject,
      }))
  },
  quiz(
    claims: SessionClaims,
    id: string,
  ): { quizz: QuizzWithId; revision: number } {
    const user = this.principal(claims),
      a = getAccounts()
    const row = a.db
      .prepare(
        "SELECT q.id,q.owner_id,q.current_revision,r.payload FROM quizzes q JOIN quiz_revisions r ON r.quiz_id=q.id AND r.revision=q.current_revision WHERE q.id=? AND q.archived_at IS NULL AND (q.owner_id=? OR ?='admin')",
      )
      .get(id, user.id, user.role)

    if (!row) {
      throw notFound("errors:quizz.notFound")
    }

    if (user.role === "admin" && row.owner_id !== user.id) {
      a.audit(user.id, "quiz.read", id)
    }

    return {
      quizz: { id, ...(JSON.parse(String(row.payload)) as QuizzValidated) },
      revision: Number(row.current_revision),
    }
  },
  assertMedia(claims: SessionClaims, quizz: QuizzValidated) {
    for (const name of mediaReferences(JSON.stringify(quizz))) {
      if (!this.canReadMedia(claims, name)) {
        throw notFound("errors:media.notFound")
      }
    }
    for (const q of quizz.questions) {
      if (
        q.media &&
        !q.media.url.startsWith("/media/") &&
        !/^https?:\/\//u.test(q.media.url)
      ) {
        throw invalidInput("errors:quizz.invalidMediaUrl")
      }
    }
  },
  saveQuiz(claims: SessionClaims, input: unknown, id?: string) {
    const payload = quizzValidator.parse(input),
      a = getAccounts()

    return a.store.transaction(() => {
      const user = this.principal(claims)
      this.assertMedia(claims, payload)
      const current = id ? this.quiz(claims, id) : undefined
      const quizId = id ?? randomUUID(),
        revision = (current?.revision ?? 0) + 1,
        date = new Date().toISOString(),
        json = JSON.stringify(payload)

      if (current) {
        a.db
          .prepare(
            "UPDATE quizzes SET current_revision=?,updated_at=? WHERE id=?",
          )
          .run(revision, date, quizId)
      } else {
        a.db
          .prepare(
            "INSERT INTO quizzes (id,owner_id,current_revision,created_at,updated_at) VALUES (?,?,1,?,?)",
          )
          .run(quizId, user.id, date, date)
      }

      a.db
        .prepare(
          "INSERT INTO quiz_revisions (quiz_id,revision,payload,sha256,author_id,created_at) VALUES (?,?,?,?,?,?)",
        )
        .run(quizId, revision, json, sha256(json), user.id, date)
      this.references(json, "quiz_revision", { id: quizId, revision })
      a.audit(user.id, current ? "quiz.update" : "quiz.create", quizId)

      return { id: quizId }
    })
  },
  deleteQuiz(claims: SessionClaims, id: string) {
    const a = getAccounts()
    a.store.transaction(() => {
      this.quiz(claims, id)
      const user = this.principal(claims)
      a.db
        .prepare("UPDATE quizzes SET archived_at=? WHERE id=?")
        .run(new Date().toISOString(), id)
      a.audit(user.id, "quiz.archive", id)
    })
  },
  results(claims: SessionClaims): GameResultMeta[] {
    const user = this.principal(claims),
      a = getAccounts()

    if (user.role === "admin") {
      a.audit(user.id, "result.list", "all")
    }

    return a.db
      .prepare(
        "SELECT id,payload FROM results WHERE deleted_at IS NULL AND (owner_id=? OR ?='admin') ORDER BY json_extract(payload,'$.date') DESC",
      )
      .all(user.id, user.role)
      .map((row) => {
        const r = JSON.parse(String(row.payload)) as GameResult

        return {
          id: String(row.id),
          subject: r.subject,
          gameMode: r.gameMode,
          date: r.date,
          playerCount: r.players.length,
        }
      })
  },
  result(claims: SessionClaims, id: string): GameResult {
    const user = this.principal(claims),
      a = getAccounts()
    const row = a.db
      .prepare(
        "SELECT owner_id,payload FROM results WHERE id=? AND deleted_at IS NULL AND (owner_id=? OR ?='admin')",
      )
      .get(id, user.id, user.role)

    if (!row) {
      throw notFound("errors:result.notFound")
    }

    if (user.role === "admin" && row.owner_id !== user.id) {
      a.audit(user.id, "result.read", id)
    }

    return JSON.parse(String(row.payload)) as GameResult
  },
  deleteResult(claims: SessionClaims, id: string) {
    const a = getAccounts()
    a.store.transaction(() => {
      this.result(claims, id)
      const user = this.principal(claims)
      a.db
        .prepare("UPDATE results SET deleted_at=? WHERE id=?")
        .run(new Date().toISOString(), id)
      a.audit(user.id, "result.delete", id)
    })
  },
  references(
    payload: string,
    kind: "quiz_revision" | "result" | "game_run",
    target: { id: string; revision?: number },
  ) {
    const { id, revision = 0 } = target
    for (const name of mediaReferences(payload)) {
      getAccounts()
        .db.prepare(
          "INSERT INTO media_references (media_name,resource_kind,resource_id,revision) VALUES (?,?,?,?)",
        )
        .run(name, kind, id, revision)
    }
  },
  startRun(claims: SessionClaims, id: string, quizId: string) {
    const a = getAccounts()

    return a.store.transaction(() => {
      const user = this.principal(claims),
        source = this.quiz(claims, quizId),
        json = JSON.stringify(source.quizz)
      a.db
        .prepare(
          "INSERT INTO game_runs (id,host_user_id,host_session_id,source_quiz_id,source_revision,snapshot,started_at) VALUES (?,?,?,?,?,?,?)",
        )
        .run(
          id,
          user.id,
          claims.sid ?? null,
          quizId,
          source.revision,
          json,
          new Date().toISOString(),
        )
      this.references(json, "game_run", { id })
      a.audit(user.id, "game.create", id)

      return source.quizz
    })
  },
  saveResult(runId: string, result: GameResult) {
    const a = getAccounts(),
      payload = JSON.stringify(parseLegacyResult(result))
    a.store.transaction(() => {
      const run = a.db
        .prepare("SELECT host_user_id FROM game_runs WHERE id=?")
        .get(runId)

      if (!run) {
        throw new Error("Missing game run")
      }

      const owner = String(run.host_user_id),
        date = new Date().toISOString()
      a.db
        .prepare(
          "INSERT INTO results (id,owner_id,game_run_id,payload,created_at) VALUES (?,?,?,?,?)",
        )
        .run(result.id, owner, runId, payload, date)
      a.db
        .prepare("UPDATE game_runs SET ended_at=? WHERE id=?")
        .run(date, runId)
      this.references(payload, "result", { id: result.id })
      a.audit(owner, "result.save", result.id)
    })
  },
  canReadMedia(claims: SessionClaims, name: string) {
    const user = this.principal(claims),
      a = getAccounts()

    const media = a.db
      .prepare(
        "SELECT name,owner_id FROM media WHERE name=? AND classification='private'",
      )
      .get(name)

    if (!media) {
      return false
    }

    if (user.role === "admin") {
      if (media.owner_id !== user.id) {
        a.audit(user.id, "media.read", name)
      }

      return true
    }

    if (
      a.db
        .prepare("SELECT name FROM media WHERE name=? AND owner_id=?")
        .get(name, user.id)
    ) {
      return true
    }

    return Boolean(
      a.db
        .prepare(
          "SELECT m.media_name FROM media_references m WHERE m.media_name=? AND ((m.resource_kind='quiz_revision' AND EXISTS (SELECT 1 FROM quizzes q WHERE q.id=m.resource_id AND q.current_revision=m.revision AND q.owner_id=? AND q.archived_at IS NULL)) OR (m.resource_kind='result' AND EXISTS (SELECT 1 FROM results r WHERE r.id=m.resource_id AND r.owner_id=? AND r.deleted_at IS NULL))) LIMIT 1",
        )
        .get(name, user.id, user.id),
    )
  },
  media(claims: SessionClaims): UploadedMedia[] {
    return listMedia().filter((item) => this.canReadMedia(claims, item.name))
  },
  async upload(claims: SessionClaims, file: File) {
    this.principal(claims)
    const uploaded = await saveMedia(file),
      filename = path.join(getPath("media"), uploaded.name),
      a = getAccounts()

    try {
      a.store.transaction(() => {
        const user = this.principal(claims),
          data = fs.readFileSync(filename)
        a.db
          .prepare(
            "INSERT INTO media (name,owner_id,sha256,size,classification,created_at) VALUES (?,?,?,?,'private',?)",
          )
          .run(
            uploaded.name,
            user.id,
            sha256(data),
            data.length,
            new Date().toISOString(),
          )
        a.audit(user.id, "media.upload", uploaded.name)
      })

      return uploaded
    } catch (error) {
      fs.unlinkSync(filename)
      throw error
    }
  },
  deleteMedia(claims: SessionClaims, name: string) {
    const user = this.principal(claims),
      a = getAccounts()
    a.store.transaction(() => {
      if (
        !a.db
          .prepare(
            "SELECT name FROM media WHERE name=? AND (owner_id=? OR ?='admin')",
          )
          .get(name, user.id, user.role)
      ) {
        throw notFound("errors:media.notFound")
      }

      if (
        a.db
          .prepare("SELECT 1 FROM media_references WHERE media_name=? LIMIT 1")
          .get(name)
      ) {
        throw new DomainError("errors:media.inUse", 409)
      }

      a.db.prepare("DELETE FROM media WHERE name=?").run(name)
      a.audit(user.id, "media.delete", name)
    })
    const filename = path.join(getPath("media"), name)

    if (fs.lstatSync(filename, { throwIfNoEntry: false })?.isFile()) {
      fs.unlinkSync(filename)
    }
  },
  reassign(claims: SessionClaims, id: string, ownerId: string) {
    const a = getAccounts()
    a.store.transaction(() => {
      const actor = a.admin(claims),
        owner = a.get(ownerId)

      if (!owner.active) {
        throw invalidInput("errors:accounts.notFound")
      }

      this.quiz(claims, id)
      a.db.prepare("UPDATE quizzes SET owner_id=? WHERE id=?").run(ownerId, id)
      a.audit(actor, "quiz.reassign", id)
    })
  },
}

export const mediaMimeByExtension = new Map<string, string>(
  Object.entries(ACCEPTED_MEDIA_TYPES).map(([mime, { ext }]) => [ext, mime]),
)
