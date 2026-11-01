import { accountQuery } from "@razzia/web/features/manager/accounts"
import type { QuizzValidated } from "@razzia/common/validators/quizz"
import AlertDialog from "@razzia/web/components/AlertDialog"
import Button from "@razzia/web/components/Button"
import { SkeletonRows } from "@razzia/web/components/Skeleton"
import {
  createQuizz,
  deleteQuizz,
  quizzKeys,
  quizzListQuery,
} from "@razzia/web/features/manager/queries"
import { api, ApiError, unwrap, unwrapEmpty } from "@razzia/web/lib/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Braces, Download, SquarePen, Trash2, Upload } from "lucide-react"

import { type ChangeEvent, useRef, useState } from "react"

import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const downloadJson = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")

  a.href = url
  a.download = filename
  a.click()

  URL.revokeObjectURL(url)
}

interface Review {
  subject: string
  count: number
  errors: Array<{ row: number; key: string }>

  warnings: Array<{ row: number; key: string }>

  confirm: () => void
}

const ConfigManageQuizz = () => {
  const { data, isPending } = useQuery(quizzListQuery())
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()

  const { data: me } = useQuery(accountQuery())
  const [review, setReview] = useState<Review | null>(null)

  const [busy, setBusy] = useState(false)

  const spreadsheetInput = useRef<HTMLInputElement>(null)

  const spreadsheetError = () => toast.error(t("manager:spreadsheet.invalid"))

  const handleSpreadsheetImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    e.target.value = ""

    if (!file) {
      return
    }

    setReview(null)

    setBusy(true)

    try {
      const { readKahoot, MAX_SPREADSHEET_BYTES } =
        await import("@razzia/web/features/manager/spreadsheet/kahoot")

      if (file.size > MAX_SPREADSHEET_BYTES) {
        throw new Error("size")
      }

      const result = await readKahoot(
        await file.arrayBuffer(),
        file.name.replace(/\.xlsx$/i, ""),
      )

      setReview({
        ...result,
        subject: result.quizz.subject,
        count: result.quizz.questions.length,
        confirm: () => {
          importQuizz(result.quizz)

          setReview(null)
        },
      })
    } catch {
      spreadsheetError()
    } finally {
      setBusy(false)
    }
  }

  const handleSpreadsheetExport = async (id: string) => {
    setReview(null)

    setBusy(true)

    try {
      const quizz = await unwrap(api.quizz[":id"].$get({ param: { id } }))

      const { reviewExport, writeKahoot } =
        await import("@razzia/web/features/manager/spreadsheet/kahoot")

      setReview({
        ...reviewExport(quizz),
        subject: quizz.subject,
        count: quizz.questions.length,
        confirm: () => {
          setReview(null)

          setBusy(true)

          void writeKahoot(quizz)
            .then((buffer) => {
              const url = URL.createObjectURL(
                new Blob([buffer], {
                  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                }),
              )

              const a = document.createElement("a")

              a.href = url

              a.download = `${quizz.subject}.xlsx`

              a.click()

              setTimeout(() => URL.revokeObjectURL(url), 1000)
            })

            .catch(spreadsheetError)

            .finally(() => setBusy(false))
        },
      })
    } catch {
      spreadsheetError()
    } finally {
      setBusy(false)
    }
  }

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: quizzKeys.all })

  const onError = (error: Error, fallback: string) => {
    toast.error(t(error instanceof ApiError ? error.key : fallback))
  }

  const { mutate: remove } = useMutation({
    mutationFn: deleteQuizz,
    onSuccess: () => {
      invalidate()
      toast.success(t("manager:quizz.deleted"))
    },
    onError: (error) => onError(error, "errors:quizz.failedToDelete"),
  })

  const { mutate: importQuizz } = useMutation({
    mutationFn: createQuizz,
    onSuccess: () => {
      invalidate()
      toast.success(t("quizz:quizzSaved"))
    },
    onError: (error) => onError(error, "errors:quizz.failedToSave"),
  })

  const handleExport = (id: string) => async () => {
    try {
      const { id: _id, ...quizz } = await unwrap(
        api.quizz[":id"].$get({ param: { id } }),
      )

      downloadJson(quizz, `${quizz.subject}.json`)
    } catch (error) {
      onError(error as Error, "errors:quizz.notFound")
    }
  }

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) {
      return
    }

    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        importQuizz(
          JSON.parse(event.target?.result as string) as QuizzValidated,
        )
      } catch {
        toast.error("Invalid JSON file")
      }
    }

    reader.readAsText(file)
    e.target.value = ""
  }

  const quizz = (data?.quizz ?? []).map((q) => ({
    ...q,
    canEdit: "canEdit" in q ? Boolean(q.canEdit) : true,
    visibility: "visibility" in q ? String(q.visibility) : "private",
  }))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="mb-2 text-sm">{t("manager:spreadsheet.help")}</p>
      {me?.user && <p className="mb-2 text-sm">{t("manager:library.help")}</p>}
      <div className="mb-4 flex shrink-0 flex-wrap gap-2">
        <Button
          className="flex-1"
          onClick={() => navigate({ to: "/manager/quizz" })}
        >
          {t("manager:quizz.create")}
        </Button>
        <Button
          className="bg-accent text-accent-foreground aspect-square px-3"
          onClick={() => fileInputRef.current?.click()}
          title={t("manager:quizz.import")}
        >
          <Upload className="size-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          aria-label={t("manager:quizz.import")}
          className="hidden"
          onChange={handleImport}
        />
      </div>
      <div className="mb-2">
        <Button
          disabled={busy}
          title={t("manager:spreadsheet.import")}
          className="inline-flex items-center gap-2"
          onClick={() => spreadsheetInput.current?.click()}
        >
          <Download className="size-4" aria-hidden="true" /> Kahoot
        </Button>
        <input
          ref={spreadsheetInput}
          type="file"
          accept=".xlsx"
          className="hidden"
          aria-label={t("manager:spreadsheet.import")}
          onChange={handleSpreadsheetImport}
        />
      </div>
      {review && (
        <section
          aria-label={t("manager:spreadsheet.review")}
          className="mb-3 max-h-60 shrink-0 overflow-auto rounded border p-3"
        >
          <h3>{t("manager:spreadsheet.review")}</h3>
          <p>
            {t("manager:spreadsheet.summary", {
              subject: review.subject,
              count: review.count,
            })}
          </p>
          <p>{t("manager:spreadsheet.limits")}</p>
          <ul>
            {[...review.errors, ...review.warnings].map((item, i) => (
              <li key={i}>
                {item.row
                  ? t("manager:spreadsheet.row", { row: item.row })
                  : t("manager:spreadsheet.general")}
                : {t(`manager:spreadsheet.issues.${item.key}`)}
              </li>
            ))}
          </ul>
          {review.errors.length === 0 && (
            <Button onClick={review.confirm}>
              {t("manager:spreadsheet.confirm")}
            </Button>
          )}
          <Button onClick={() => setReview(null)}>{t("common:cancel")}</Button>
        </section>
      )}
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-0.5">
        {isPending && <SkeletonRows className="h-12" />}
        {quizz.map((q) => (
          <div
            key={q.id}
            className="border-accent flex w-full flex-col gap-2 rounded-md border-2 p-2"
          >
            <p className="text-foreground truncate font-medium">{q.subject}</p>
            <div className="flex flex-wrap items-center justify-end gap-1">
              {me?.user &&
                (q.canEdit ? (
                  <label className="mr-auto text-sm">
                    <span className="sr-only">
                      {t("manager:library.visibilityFor", { name: q.subject })}
                    </span>
                    <select
                      className="bg-background rounded border p-1"
                      value={q.visibility}
                      disabled={busy}
                      onChange={async (event) => {
                        const visibility = event.target.value as
                          "private" | "public"
                        setBusy(true)

                        try {
                          await unwrapEmpty(
                            api.quizz[":id"].visibility.$patch({
                              param: { id: q.id },
                              json: { visibility },
                            }),
                          )
                          await invalidate()
                        } catch (error) {
                          onError(error as Error, "errors:quizz.failedToSave")
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      <option value="private">
                        {t("manager:library.private")}
                      </option>
                      <option value="public">
                        {t("manager:library.public")}
                      </option>
                    </select>
                  </label>
                ) : (
                  <span className="mr-auto text-sm">
                    {t("manager:library.readOnly")}
                  </span>
                ))}
              {q.canEdit && (
                <button
                  className="text-accent-foreground hover:bg-accent-foreground/10 rounded-sm p-2"
                  title={t("manager:quizz.edit")}
                  onClick={() =>
                    navigate({
                      to: "/manager/quizz/$quizzId",
                      params: { quizzId: q.id },
                    })
                  }
                >
                  <SquarePen className="size-4" />
                </button>
              )}
              <button
                className="text-accent-foreground hover:bg-accent-foreground/10 rounded-sm p-2"
                onClick={() => handleExport(q.id)()}
                title={t("manager:quizz.export")}
              >
                <Braces className="size-4" />
              </button>
              <button
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-sm p-2"
                title={t("manager:spreadsheet.export")}
                onClick={() => handleSpreadsheetExport(q.id)}
              >
                <Upload className="size-4" aria-hidden="true" /> Kahoot
              </button>
              {q.canEdit && (
                <AlertDialog
                  trigger={
                    <button
                      className="rounded-sm p-2 hover:bg-red-600/10"
                      title={t("manager:quizz.delete")}
                    >
                      <Trash2 className="size-4 stroke-red-500" />
                    </button>
                  }
                  title={t("manager:quizz.delete")}
                  description={t("manager:quizz.deleteConfirm", {
                    name: q.subject,
                  })}
                  confirmLabel={t("common:delete")}
                  onConfirm={() => remove(q.id)}
                />
              )}
            </div>
          </div>
        ))}
        {!isPending && quizz.length === 0 && (
          <p className="text-muted-foreground my-8 text-center">
            {t("manager:quizz.none")}
          </p>
        )}
      </div>
    </div>
  )
}

export default ConfigManageQuizz
