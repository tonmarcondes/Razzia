import { useId } from "react"
import { useTranslation } from "react-i18next"
import type { ManagerStatusDataMap } from "@razzia/common/types/game/status"
import AvatarView from "@razzia/web/features/avatars/AvatarView"
import Fire from "@razzia/web/features/game/components/icons/Fire"

interface Props {
  data: ManagerStatusDataMap["SHOW_LEADERBOARD"]
}

const Leaderboard = ({ data: { leaderboard } }: Props) => {
  const { t } = useTranslation()
  const headingId = useId()

  return (
    <section
      aria-labelledby={headingId}
      className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-2 py-4"
    >
      <h2
        id={headingId}
        className="text-center text-3xl font-bold text-white drop-shadow-md sm:text-5xl"
      >
        {t("game:leaderboard")}
      </h2>
      <ol className="flex w-full flex-col gap-2">
        {leaderboard.map(({ id, username, points, streak, avatar }, index) => (
          <li
            key={id}
            className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-primary p-3 text-xl font-bold text-white sm:gap-3 sm:text-3xl"
          >
            <span className="tabular-nums drop-shadow-md">{index + 1}.</span>
            <span className="flex min-w-0 items-center gap-2 drop-shadow-md">
              {avatar && (
                <AvatarView
                  avatar={avatar}
                  className="size-10 shrink-0 sm:size-14"
                />
              )}
              <span className="min-w-0 [overflow-wrap:anywhere] break-words">
                {username}
              </span>
              {streak >= 2 && (
                <span
                  role="img"
                  aria-label={t("game:streak")}
                  className="flex shrink-0 items-center rounded-full bg-amber-700 p-1"
                >
                  <Fire className="size-5 sm:size-7" />
                </span>
              )}
            </span>
            <span className="tabular-nums drop-shadow-md">{points}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default Leaderboard
