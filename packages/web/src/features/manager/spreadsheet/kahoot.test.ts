import ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"
import { readKahoot, reviewExport, writeKahoot } from "./kahoot"
import type { QuizzValidated } from "@razzia/common/validators/quizz"
const quiz = (): QuizzValidated => ({
  gameMode: "quiz",
  subject: "Aviação",
  questions: [
    {
      type: "multi",
      question: "Quais?",
      answers: ["Ação", "Não", "Sim"],
      solutions: [0, 2],
      cooldown: 5,
      time: 30,
      options: { scoringMode: "strict" },
    },
  ],
})
describe("Kahoot spreadsheet exchange", () => {
  it("rejects archives whose declared expanded contents exceed the budget", async () => {
    const data = new Uint8Array(await writeKahoot(quiz()))
    const view = new DataView(data.buffer)
    for (let i = 0; i < data.length - 46; i += 1) {
      if (view.getUint32(i, true) === 0x02014b50) {
        view.setUint32(i + 24, 17 * 1024 * 1024, true)

        break
      }
    }
    await expect(readKahoot(data.buffer, "x")).rejects.toThrow("archive")
  })
  it("preserves Portuguese, answer order, multiple correct answers and time", async () => {
    const original = quiz()
    const result = await readKahoot(
      await writeKahoot(original),
      original.subject,
    )
    expect(result.errors).toEqual([])
    expect(result.quizz).toEqual(original)
  })
  it("writes official template coordinates and literal formula-like text", async () => {
    const q = quiz()
    q.questions[0].question = "=1+1"
    const w = new ExcelJS.Workbook()
    await w.xlsx.load(await writeKahoot(q))
    expect(w.worksheets[0].getCell("B9").value).toBe("=1+1")
    expect(w.worksheets[0].getCell("H9").value).toBe("1,3")
  })
  it("blocks incompatible questions without silently truncating", async () => {
    const q = quiz()
    q.questions[0].question = "a".repeat(121)
    q.questions[0].time = 15
    expect(reviewExport(q).errors.map((e) => e.key)).toEqual([
      "question",
      "time",
    ])
    await expect(writeKahoot(q)).rejects.toThrow()
  })
  it("warns about fields not transported", () => {
    const q = quiz()
    q.questions[0].media = { type: "image", url: "/media/example.png" }
    expect(reviewExport(q).warnings.map((e) => e.key)).toEqual([
      "metadata",
      "scoring",
    ])
  })
  it("rejects reports and oversized files", async () => {
    await expect(
      readKahoot(new ArrayBuffer(1024 * 1024 + 1), "x"),
    ).rejects.toThrow("size")
    const w = new ExcelJS.Workbook()
    w.addWorksheet("Report").addRow(["Nickname", "Score"])
    await expect(readKahoot(await w.xlsx.writeBuffer(), "x")).rejects.toThrow(
      "template",
    )
  })
  it("reports original row numbers and refuses formulas, gaps and invalid solution indexes", async () => {
    const w = new ExcelJS.Workbook()
    await w.xlsx.load(await writeKahoot(quiz()))
    const [s] = w.worksheets
    s.getCell("H9").value = "4"
    s.getCell("D9").value = ""
    s.getRow(10).values = [2, { formula: "1+1" }, "Yes", "No", "", "", 30, 1]
    const result = await readKahoot(await w.xlsx.writeBuffer(), "x")
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { row: 9, key: "answers" },
        { row: 9, key: "solutions" },
        { row: 10, key: "cell" },
      ]),
    )
  })
  it("rejects survey mode and duplicate correct answers", () => {
    const q = quiz()
    q.gameMode = "survey"
    q.questions[0].solutions = [0, 0]
    expect(reviewExport(q).errors.map((e) => e.key)).toEqual([
      "mode",
      "solutions",
    ])
  })
})

const portugueseWorkbook = () => {
  const w = new ExcelJS.Workbook()
  w.addWorksheet("Lista de temas").addRow([
    "Nº",
    "Tema prioritário",
    "Foco de estudo",
  ])
  const s = w.addWorksheet("Questões")
  s.addRow([
    "Número",
    "Tema",
    "Pergunta Kahoot",
    "Alternativa A",
    "Alternativa B",
    "Alternativa C",
    "Alternativa D",
    "Resposta correta",
    "Justificativa / foco de estudo",
  ])
  s.addRow([
    1,
    "Aviação",
    "Qual alternativa?",
    "Ação",
    "Não",
    "Sim",
    "Outra",
    "C",
    "Explicação",
  ])

  return { w, s }
}

describe("Portuguese question workbook", () => {
  it("selects the question sheet and preserves letters, topic and explanation", async () => {
    const { w } = portugueseWorkbook()
    const result = await readKahoot(await w.xlsx.writeBuffer(), "Treinamento")
    expect(result.errors).toEqual([])
    expect(result.quizz.questions).toEqual([
      {
        type: "single",
        question: "Qual alternativa?",
        answers: ["Ação", "Não", "Sim", "Outra"],
        solutions: [2],
        category: "Aviação",
        note: "Explicação",
        cooldown: 5,
        time: 30,
      },
    ])
    expect(result.warnings.map((i) => i.key)).toEqual([
      "defaults",
      "adapted",
      "worksheets",
    ])
  })
  it("preserves long text without weakening official export limits", async () => {
    const { w, s } = portugueseWorkbook()
    s.getCell("D2").value = "A".repeat(90)
    const result = await readKahoot(await w.xlsx.writeBuffer(), "x")
    expect(result.errors).toEqual([])
    expect(result.quizz.questions[0].answers[0]).toHaveLength(90)
    expect(result.warnings).toContainEqual({ row: 2, key: "lengths" })
    expect(reviewExport(result.quizz).errors).toContainEqual({
      row: 1,
      key: "answers",
    })
  })
  it("rejects ambiguous worksheets", async () => {
    const { w, s } = portugueseWorkbook()
    w.addWorksheet("Other questions").addRow(s.getRow(1).values)
    await expect(readKahoot(await w.xlsx.writeBuffer(), "x")).rejects.toThrow(
      "template",
    )
  })
  it("reports invalid letters, duplicates, gaps and formulas in metadata", async () => {
    await Promise.all(
      ["E", "A,A"].map(async (answer) => {
        const { w, s } = portugueseWorkbook()
        s.getCell("H2").value = answer
        expect(
          (await readKahoot(await w.xlsx.writeBuffer(), "x")).errors,
        ).toContainEqual({ row: 2, key: "solutions" })
      }),
    )
    const { w, s } = portugueseWorkbook()
    s.getCell("E2").value = ""
    expect(
      (await readKahoot(await w.xlsx.writeBuffer(), "x")).errors,
    ).toContainEqual({ row: 2, key: "answers" })
    s.getCell("I2").value = { formula: "1+1" }
    expect(
      (await readKahoot(await w.xlsx.writeBuffer(), "x")).errors,
    ).toContainEqual({ row: 2, key: "cell" })
  })
  it("maps multiple letter solutions without reordering answers", async () => {
    const { w, s } = portugueseWorkbook()
    s.getCell("H2").value = "a, D"
    const result = await readKahoot(await w.xlsx.writeBuffer(), "x")
    expect(result.errors).toEqual([])
    expect(result.quizz.questions[0]).toMatchObject({
      type: "multi",
      solutions: [0, 3],
      options: { scoringMode: "strict" },
    })
  })
})
