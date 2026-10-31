import {
  quizzValidator,
  type QuizzValidated,
} from "@razzia/common/validators/quizz"

import ExcelJS from "exceljs"

export const KAHOOT_TIMES = [5, 10, 20, 30, 60, 120]

export const MAX_SPREADSHEET_BYTES = 1024 * 1024

const MAX_QUESTIONS = 100

export interface SpreadsheetIssue {
  row: number
  key: string
}

export interface SpreadsheetReview {
  quizz: QuizzValidated

  errors: SpreadsheetIssue[]

  warnings: SpreadsheetIssue[]
}

const issue = (row: number, key: string): SpreadsheetIssue => ({ row, key })

export const reviewExport = (quizz: QuizzValidated) => {
  const errors: SpreadsheetIssue[] = []

  const warnings: SpreadsheetIssue[] = []

  if (quizz.gameMode !== "quiz") {
    errors.push(issue(0, "mode"))
  }

  if (quizz.questions.length > MAX_QUESTIONS) {
    errors.push(issue(0, "count"))
  }

  quizz.questions.forEach((q, i) => {
    const row = i + 1

    if (q.type === "estimation") {
      errors.push(issue(row, "type"))
    }

    if (!q.question.trim() || q.question.length > 120) {
      errors.push(issue(row, "question"))
    }

    if (
      q.answers.length < 2 ||
      q.answers.length > 4 ||
      q.answers.some((a) => !a.trim() || a.length > 75)
    ) {
      errors.push(issue(row, "answers"))
    }

    if (!KAHOOT_TIMES.includes(q.time)) {
      errors.push(issue(row, "time"))
    }

    if (
      !q.solutions?.length ||
      new Set(q.solutions).size !== q.solutions.length ||
      q.solutions.some(
        (s) => !Number.isInteger(s) || s < 0 || s >= q.answers.length,
      )
    ) {
      errors.push(issue(row, "solutions"))
    }

    if (q.media || q.note || q.category) {
      warnings.push(issue(row, "metadata"))
    }

    if (
      q.cooldown !== 5 ||
      (q.maxPoints !== undefined && q.maxPoints !== 1000) ||
      (q.penalty ?? 0) !== 0 ||
      q.type === "multi"
    ) {
      warnings.push(issue(row, "scoring"))
    }
  })

  return { errors, warnings }
}

export const writeKahoot = async (
  quizz: QuizzValidated,
): Promise<ArrayBuffer> => {
  if (reviewExport(quizz).errors.length) {
    throw new Error("incompatible")
  }

  const workbook = new ExcelJS.Workbook()

  const sheet = workbook.addWorksheet("Sheet1")

  sheet.getCell("B2").value = "Quiz template"

  sheet.getCell("B3").value =
    "Questions: 120 characters. Answers: 75 characters. Correct answers: comma-separated numbers."

  sheet.getRow(8).values = [
    "",
    "Question - 120 max length",
    "Answer 1 - 75 max length",
    "Answer 2 - 75 max length",
    "Answer 3 - 75 max length",
    "Answer 4 - 75 max length",
    "Time limit",
    "Correct answer(s)",
  ]

  quizz.questions.forEach((q, i) => {
    sheet.getRow(i + 9).values = [
      i + 1,
      q.question,
      ...Array.from({ length: 4 }, (_, a) => q.answers[a] ?? ""),
      q.time,
      q.solutions?.map((s) => s + 1).join(","),
    ]
  })

  sheet.getColumn(2).width = 60

  for (const col of [3, 4, 5, 6]) {
    sheet.getColumn(col).width = 25
  }

  sheet.getColumn(7).width = 16

  sheet.getColumn(8).width = 22

  sheet.getRow(8).font = { bold: true }

  return new Uint8Array(await workbook.xlsx.writeBuffer()).buffer
}

// Reject oversized declared ZIP contents before the XLSX parser allocates them.
const checkArchive = (buffer: ArrayBuffer) => {
  const view = new DataView(new Uint8Array(buffer).buffer)
  let end = view.byteLength - 22

  while (
    end >= Math.max(0, view.byteLength - 65557) &&
    view.getUint32(end, true) !== 0x06054b50
  ) {
    end -= 1
  }

  if (end < 0 || view.getUint32(end, true) !== 0x06054b50) {
    throw new Error("archive")
  }

  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  let expanded = 0

  if (
    count > 256 ||
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0
  ) {
    throw new Error("archive")
  }

  for (let i = 0; i < count; i += 1) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("archive")
    }

    expanded += view.getUint32(offset + 24, true)

    if (
      expanded > 16 * 1024 * 1024 ||
      (view.getUint16(offset + 8, true) & 1) !== 0
    ) {
      throw new Error("archive")
    }

    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true)
  }
}

export const readKahoot = async (
  buffer: ArrayBuffer,
  subject: string,
): Promise<SpreadsheetReview> => {
  if (buffer.byteLength > MAX_SPREADSHEET_BYTES) {
    throw new Error("size")
  }

  checkArchive(buffer)

  const workbook = new ExcelJS.Workbook()

  await workbook.xlsx.load(buffer)

  if (workbook.worksheets.length !== 1) {
    throw new Error("template")
  }

  const [sheet] = workbook.worksheets

  const expected = [
    "Question",
    "Answer 1",
    "Answer 2",
    "Answer 3",
    "Answer 4",
    "Time limit",
    "Correct answer(s)",
  ]

  let header = 0

  for (let r = 1; r <= Math.min(sheet.rowCount, 30); r += 1) {
    if (
      expected.every((name, i) => sheet.getCell(r, i + 2).text.startsWith(name))
    ) {
      header = r

      break
    }
  }

  if (!header || sheet.rowCount > 1000 || sheet.columnCount > 20) {
    throw new Error("template")
  }

  const questions: QuizzValidated["questions"] = []

  const errors: SpreadsheetIssue[] = []

  for (let r = header + 1; r <= sheet.rowCount; r += 1) {
    const cells = Array.from({ length: 7 }, (_, i) => sheet.getCell(r, i + 2))

    if (cells.every((c) => c.value === null || c.value === "")) {
      continue
    }

    if (cells.some((c) => typeof c.value === "object" && c.value !== null)) {
      errors.push(issue(r, "cell"))

      continue
    }

    const values = cells.map((c) => c.text)

    const answers = values.slice(1, 5)

    while (answers.at(-1) === "") {
      answers.pop()
    }

    const [, , , , , , raw] = values

    const solutions = /^\d+(\s*,\s*\d+)*$/.test(raw)
      ? raw.split(",").map((s) => Number(s.trim()) - 1)
      : []

    const q = {
      type: solutions.length > 1 ? ("multi" as const) : ("single" as const),
      question: values[0],
      answers,
      solutions,
      cooldown: 5,
      time: Number(values[5]),
      ...(solutions.length > 1
        ? { options: { scoringMode: "strict" as const } }
        : {}),
    }

    const review = reviewExport({ gameMode: "quiz", subject, questions: [q] })

    errors.push(...review.errors.map((e) => ({ ...e, row: r })))

    questions.push(q)
  }

  if (!questions.length) {
    errors.push(issue(0, "empty"))
  }

  if (questions.length > MAX_QUESTIONS) {
    errors.push(issue(0, "count"))
  }

  const quizz = { gameMode: "quiz" as const, subject, questions }

  if (!errors.length) {
    quizzValidator.parse(quizz)
  }

  return { quizz, errors, warnings: [issue(0, "defaults")] }
}
