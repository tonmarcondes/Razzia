import {
  BACKGROUND_STAGES,
  BRANDING_ASSET_MAX_SIZE,
  type BackgroundStage,
  type BrandingTheme,
} from "@razzia/common/validators/branding"
import defaultLogo from "@razzia/web/assets/logo.svg"
import defaultBackground from "@razzia/web/assets/background.png"
import { imageFallback } from "@razzia/web/branding"
import AlertDialog from "@razzia/web/components/AlertDialog"
import Button from "@razzia/web/components/Button"
import {
  brandingQuery,
  saveBranding,
  restoreBranding,
  uploadBranding,
} from "@razzia/web/features/manager/queries"
import { ApiError } from "@razzia/web/lib/api"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const inputClass =
  "border-accent bg-background text-foreground min-w-0 w-full rounded-lg border px-3 py-2 text-sm"
const defaultAnswers = ["#e69f00", "#56b4e9", "#3dbfa0", "#cc79a7"]
const defaultColors = {
  primary: "#ff9900",
  secondary: "#1a140b",
  correct: "#22c55e",
  background: "#ffffff",
  foreground: "#374151",
}

const AssetField = ({
  label,
  value,
  onChange,
  onUpload,
  disabled,
}: {
  label: string
  value?: string
  onChange: (value?: string) => void
  onUpload: (file: File) => Promise<string>
  disabled: boolean
}) => {
  const { t } = useTranslation()

  return (
    <fieldset className="min-w-0 space-y-2 rounded-lg border border-gray-200 p-3">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <label className="block space-y-1">
        <span className="text-xs text-gray-600">
          {t("manager:appearance.imageUrl")}
        </span>
        <input
          className={inputClass}
          aria-label={label}
          value={value ?? ""}
          maxLength={2048}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="https://…"
        />
      </label>
      <label className="block text-xs text-gray-600">
        {t("manager:appearance.uploadFor", { label })}
        <input
          type="file"
          aria-label={t("manager:appearance.uploadFor", { label })}
          accept=".png,.jpg,.jpeg,.webp,.gif,.ico"
          disabled={disabled}
          className="mt-1 block w-full min-w-0 text-xs file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-2"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ""

            if (file) {
              try {
                onChange(await onUpload(file))
              } catch {
                /* The mutation displays the translated error. */
              }
            }
          }}
        />
      </label>
      {value && (
        <button
          type="button"
          className="text-xs font-semibold text-red-600"
          onClick={() => onChange(undefined)}
        >
          {t("manager:appearance.removeFor", { label })}
        </button>
      )}
    </fieldset>
  )
}

const AppearanceEditor = ({
  initial,
  revision,
}: {
  initial: BrandingTheme
  revision: string
}) => {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<BrandingTheme>(initial)
  const [stage, setStage] = useState<BackgroundStage>("home")
  const dirty = JSON.stringify(initial) !== JSON.stringify(draft)
  const onError = (error: Error) =>
    toast.error(
      t(error instanceof ApiError ? error.key : "errors:branding.failedToSave"),
    )
  const apply = () => {
    sessionStorage.setItem("brandingSaved", "1")
    window.location.reload()
  }
  const save = useMutation({
    mutationFn: saveBranding,
    onSuccess: apply,
    onError,
  })
  const reset = useMutation({
    mutationFn: restoreBranding,
    onSuccess: apply,
    onError,
  })
  const upload = useMutation({
    mutationFn: (file: File) => {
      if (!file.size || file.size > BRANDING_ASSET_MAX_SIZE) {
        throw new ApiError(400, "errors:branding.invalidAsset")
      }

      return uploadBranding(file)
    },
    onError,
  })
  const busy = save.isPending || reset.isPending || upload.isPending
  useEffect(() => {
    if (sessionStorage.getItem("brandingSaved")) {
      sessionStorage.removeItem("brandingSaved")
      toast.success(t("manager:appearance.saved"))
    }
  }, [t])
  const assetProps = {
    disabled: busy,
    onUpload: async (file: File) => (await upload.mutateAsync(file)).url,
  }
  const background =
    draft.backgrounds?.[stage] ??
    draft.background ??
    (stage === "home" ? undefined : defaultBackground)
  const primary = draft.colors?.primary ?? defaultColors.primary
  const secondary = draft.colors?.secondary ?? defaultColors.secondary

  return (
    <form
      className="flex min-h-0 flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate({ theme: draft, revision })
      }}
    >
      <div className="grid min-h-0 gap-5 overflow-y-auto pr-1 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <p className="text-sm text-gray-600">
            {t("manager:appearance.applyHint")}
          </p>
          <fieldset className="space-y-3">
            <legend className="mb-2 font-semibold">
              {t("manager:appearance.identity")}
            </legend>
            <label className="block space-y-1 text-sm font-semibold">
              {t("manager:appearance.appName")}
              <input
                className={inputClass}
                maxLength={80}
                placeholder="Razzia"
                value={draft.appName ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    appName: e.target.value || undefined,
                  }))
                }
              />
            </label>
            <label className="block space-y-1 text-sm font-semibold">
              {t("manager:appearance.font")}
              <input
                className={inputClass}
                maxLength={100}
                placeholder="Rubik Variable"
                value={draft.font?.family ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    font: e.target.value
                      ? { ...d.font, family: e.target.value }
                      : undefined,
                  }))
                }
              />
            </label>
            <AssetField
              label={t("manager:appearance.logo")}
              value={draft.logo}
              onChange={(logo) => setDraft((d) => ({ ...d, logo }))}
              {...assetProps}
            />
            <AssetField
              label={t("manager:appearance.favicon")}
              value={draft.favicon}
              onChange={(favicon) => setDraft((d) => ({ ...d, favicon }))}
              {...assetProps}
            />
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="mb-2 font-semibold">
              {t("manager:appearance.colors")}
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(defaultColors).map(([key, fallback]) => (
                <label key={key} className="space-y-1 text-sm">
                  {t(`manager:appearance.color.${key}`)}
                  <div className="flex gap-2">
                    <input
                      type="color"
                      aria-label={t(`manager:appearance.color.${key}`)}
                      className="h-10 w-12 shrink-0 rounded border"
                      value={
                        /^#[\da-f]{6}$/iu.test(draft.colors?.[key] ?? "")
                          ? (draft.colors?.[key] ?? fallback)
                          : fallback
                      }
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          colors: { ...d.colors, [key]: e.target.value },
                        }))
                      }
                    />
                    <input
                      aria-label={t("manager:appearance.colorValue", {
                        label: t(`manager:appearance.color.${key}`),
                      })}
                      className={inputClass}
                      maxLength={160}
                      value={draft.colors?.[key] ?? fallback}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          colors: { ...d.colors, [key]: e.target.value },
                        }))
                      }
                    />
                  </div>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {defaultAnswers.map((fallback, index) => (
                <label key={index} className="flex items-center gap-2 text-sm">
                  <input
                    type="color"
                    aria-label={t("manager:appearance.answerColor", {
                      number: index + 1,
                    })}
                    value={draft.answerColors?.[index] ?? fallback}
                    onChange={(e) =>
                      setDraft((d) => {
                        const colors = defaultAnswers.map(
                          (color, i) => d.answerColors?.[i] ?? color,
                        )
                        colors[index] = e.target.value

                        return { ...d, answerColors: colors }
                      })
                    }
                  />
                  {t("manager:appearance.answerColor", { number: index + 1 })}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="mb-2 font-semibold">
              {t("manager:appearance.backgrounds")}
            </legend>
            <p className="text-xs text-gray-600">
              {t("manager:appearance.uploadHint")}
            </p>
            <AssetField
              label={t("manager:appearance.defaultBackground")}
              value={draft.background}
              onChange={(url) => setDraft((d) => ({ ...d, background: url }))}
              {...assetProps}
            />
            {BACKGROUND_STAGES.map((s) => (
              <AssetField
                key={s}
                label={t(`manager:appearance.stage.${s}`)}
                value={draft.backgrounds?.[s]}
                onChange={(url) =>
                  setDraft((d) => ({
                    ...d,
                    backgrounds: { ...d.backgrounds, [s]: url },
                  }))
                }
                {...assetProps}
              />
            ))}
          </fieldset>
        </div>
        <div className="min-w-0 space-y-4 lg:self-start">
          <label className="block space-y-1 text-sm font-semibold">
            {t("manager:appearance.previewStage")}
            <select
              className={inputClass}
              value={stage}
              onChange={(e) => setStage(e.target.value as BackgroundStage)}
            >
              {BACKGROUND_STAGES.map((s) => (
                <option key={s} value={s}>
                  {t(`manager:appearance.stage.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <section
            aria-label={t("manager:appearance.preview")}
            className="relative isolate flex min-h-64 flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border p-4"
            style={{ backgroundColor: secondary }}
          >
            {background ? (
              <img
                src={background}
                onError={imageFallback(defaultBackground)}
                className="absolute inset-0 -z-10 h-full w-full object-cover"
                alt=""
              />
            ) : (
              <div
                className="absolute -top-10 -left-10 -z-10 h-48 w-48 rotate-12 rounded-3xl opacity-20"
                style={{ backgroundColor: primary }}
              />
            )}
            <img
              src={draft.logo ?? defaultLogo}
              onError={imageFallback(defaultLogo)}
              alt={t("manager:appearance.logo")}
              className="h-8 max-w-full object-contain"
            />
            <h2
              className="text-center text-xl font-bold"
              style={{ color: primary, fontFamily: draft.font?.family }}
            >
              {draft.appName ?? "Razzia"}
            </h2>
            <div
              className="w-full space-y-3 rounded-xl p-4 shadow"
              style={{
                backgroundColor:
                  draft.colors?.background ?? defaultColors.background,
                color: draft.colors?.foreground ?? defaultColors.foreground,
              }}
            >
              <p className="text-center font-semibold">
                {t("manager:appearance.previewQuestion")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {defaultAnswers.map((color, index) => (
                  <span
                    key={index}
                    className="rounded-lg p-2 text-center text-sm font-bold text-white"
                    style={{
                      backgroundColor: draft.answerColors?.[index] ?? color,
                    }}
                  >
                    {t("manager:appearance.previewAnswer", {
                      number: index + 1,
                    })}
                  </span>
                ))}
              </div>
              <div
                className="rounded-lg p-2 text-center font-bold text-white"
                style={{ backgroundColor: primary }}
              >
                {t("game:startGame")}
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className="shrink-0 space-y-2 border-t border-gray-200 pt-3">
        {dirty && (
          <p role="status" className="text-sm font-semibold text-amber-700">
            {t("manager:appearance.unsaved")}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {save.isPending
              ? t("common:loading")
              : t("manager:appearance.save")}
          </Button>
          <Button
            type="button"
            className="bg-gray-100 text-gray-700"
            disabled={busy || !dirty}
            onClick={() => setDraft(initial)}
          >
            {t("manager:appearance.discard")}
          </Button>
        </div>
        <AlertDialog
          trigger={
            <Button
              type="button"
              disabled={busy}
              className="bg-gray-100 text-gray-700"
            >
              {t("manager:appearance.reset")}
            </Button>
          }
          title={t("manager:appearance.reset")}
          description={t("manager:appearance.resetConfirm")}
          onConfirm={() => reset.mutate(revision)}
        />
      </div>
    </form>
  )
}

const ConfigAppearance = () => {
  const { data, isPending, isError } = useQuery(brandingQuery())
  const { t } = useTranslation()

  if (isPending) {
    return <p>{t("common:loading")}</p>
  }

  if (isError) {
    return (
      <div role="alert" className="space-y-3">
        <p>{t("errors:branding.failedToRead")}</p>
        <Button onClick={() => window.location.reload()}>
          {t("manager:appearance.reload")}
        </Button>
      </div>
    )
  }

  return (
    <AppearanceEditor
      key={data.revision}
      initial={data.theme}
      revision={data.revision}
    />
  )
}

export default ConfigAppearance
