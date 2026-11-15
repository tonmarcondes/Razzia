import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AVATAR_OPTIONS,
  avatarSchema,
  randomAvatar,
  type Avatar,
} from "@razzia/common/avatar"
import Button from "@razzia/web/components/Button"
import AvatarView from "./AvatarView"

const groups = {
  base: ["skin", "ears"],
  detail: ["detail"],
  brows: ["brows"],
  eyes: ["eyes", "glasses", "shadow"],
  mouth: ["mouth", "lipstick"],
  hair: ["hair", "hairColor"],
  clothes: ["clothes", "clothesColor", "badge"],
  accessories: ["hat", "headset", "hand", "neck", "earrings"],
} as const

export interface AvatarSetup {
  deadline: number
  serverNow: number
  avatar: Avatar
}

const AvatarEditor = ({
  setup,
  busy,
  onComplete,
}: {
  setup: AvatarSetup
  busy: boolean
  onComplete: (_avatar?: Avatar) => void
}) => {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Avatar>(() => {
    try {
      const saved: unknown = JSON.parse(
        sessionStorage.getItem(`avatar-draft-${setup.deadline}`) ?? "null",
      )
      const parsed = avatarSchema.safeParse(saved)

      return parsed.success ? parsed.data : setup.avatar
    } catch {
      return setup.avatar
    }
  })
  const [category, setCategory] = useState<keyof typeof groups>("base")
  const [end] = useState(
    () => Date.now() + Math.max(0, setup.deadline - setup.serverNow),
  )
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((end - Date.now()) / 1000)),
  )
  const submitted = useRef(false)
  const pending = useRef(busy)
  const complete = useRef(onComplete)
  useEffect(() => {
    complete.current = onComplete
    pending.current = busy
  }, [onComplete, busy])
  useEffect(() => {
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setRemaining(seconds)

      if (seconds === 0 && !submitted.current && !pending.current) {
        submitted.current = true
        complete.current()
      }
    }
    const timer = setInterval(tick, 250)
    tick()

    return () => clearInterval(timer)
  }, [end])
  useEffect(() => {
    sessionStorage.setItem(
      `avatar-draft-${setup.deadline}`,
      JSON.stringify(selected),
    )
  }, [selected, setup.deadline])

  const finish = (avatar?: Avatar) => {
    if (pending.current) {
      return
    }

    pending.current = true
    onComplete(avatar)
  }

  return (
    <section
      aria-label={t("avatar:title")}
      className="z-10 mx-auto w-full max-w-2xl rounded-2xl bg-background p-4 shadow-xl"
    >
      <h1 className="text-center text-2xl font-bold">{t("avatar:title")}</h1>
      <div className="sticky top-0 z-10 flex items-center justify-center gap-5 bg-background py-3">
        <AvatarView
          avatar={selected}
          label={t("avatar:preview")}
          className="h-44 w-36 shrink-0"
        />
        <div className="flex flex-col gap-3">
          <p role="timer" className="font-semibold tabular-nums">
            {t("avatar:remaining", { count: remaining })}
          </p>
          <Button
            disabled={remaining === 0 || busy}
            onClick={() => setSelected(randomAvatar())}
          >
            {t("avatar:randomize")}
          </Button>
        </div>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("avatar:title")}
      >
        {Object.keys(groups).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={category === key}
            onClick={() => setCategory(key as keyof typeof groups)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${category === key ? "bg-primary text-white" : "bg-muted text-foreground"}`}
          >
            {t(`avatar:categories.${key}`)}
          </button>
        ))}
      </div>
      <fieldset
        disabled={remaining === 0 || busy}
        className="my-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {groups[category].map((key) => (
          <label key={key} className="flex flex-col gap-1 font-semibold">
            {t(`avatar:fields.${key}`)}
            <select
              aria-label={t(`avatar:fields.${key}`)}
              className="min-h-11 w-full rounded-lg border border-accent bg-background px-3 py-2"
              value={selected[key]}
              onChange={(e) =>
                setSelected((a) => ({ ...a, [key]: e.target.value }))
              }
            >
              {AVATAR_OPTIONS[key].map((value) => (
                <option key={value} value={value}>
                  {t(`avatar:options.${key}.${value}`)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </fieldset>
      {remaining === 0 && (
        <p role="status" className="mb-3 font-semibold">
          {t("avatar:expired")}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="flex-1"
          disabled={busy}
          onClick={() => finish(remaining > 0 ? selected : undefined)}
        >
          {t(remaining > 0 ? "avatar:confirm" : "avatar:retry")}
        </Button>
        {remaining > 0 && (
          <Button
            className="flex-1 bg-muted text-foreground"
            disabled={busy}
            onClick={() => finish()}
          >
            {t("avatar:skip")}
          </Button>
        )}
      </div>
    </section>
  )
}

export default AvatarEditor
