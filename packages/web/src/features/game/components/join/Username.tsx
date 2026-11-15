import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { StatusCodes } from "http-status-codes"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import type { Avatar } from "@razzia/common/avatar"
import { STATUS } from "@razzia/common/types/game/status"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import AvatarEditor, {
  type AvatarSetup,
} from "@razzia/web/features/avatars/AvatarEditor"
import { joinGame } from "@razzia/web/features/game/queries"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { createStatus } from "@razzia/web/features/game/utils/createStatus"
import { ApiError } from "@razzia/web/lib/api"

const Username = () => {
  const { inviteCode, generatedUsernames, updatePlayer } = usePlayerStore()
  const navigate = useNavigate()
  const [username, setUsername] = useState(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("avatar-join") ?? "null",
      ) as { inviteCode?: string; username?: string } | null

      return saved?.inviteCode === inviteCode ? (saved.username ?? "") : ""
    } catch {
      return ""
    }
  })
  const { t } = useTranslation()
  const [setup, setSetup] = useState<AvatarSetup | null>(null)
  const resumed = useRef(false)

  const { mutate: join, isPending } = useMutation({
    mutationFn: joinGame,
    onSuccess: ({ gameId, ticket, username: name, avatarSetup }) => {
      if (avatarSetup) {
        setSetup(avatarSetup)

        return
      }

      sessionStorage.removeItem("avatar-join")

      if (setup) {
        sessionStorage.removeItem(`avatar-draft-${setup.deadline}`)
      }

      localStorage.setItem("game_id", gameId)

      if (inviteCode) {
        localStorage.setItem("game_pin", inviteCode)
      }

      updatePlayer({
        gameId,
        joinTicket: ticket,
        player: name ? { username: name, points: 0 } : null,
        status: createStatus(STATUS.WAIT, { text: "game:waitingForPlayers" }),
      })
      navigate({ to: "/party/$gameId", params: { gameId } })
    },
    retry: (count, error) =>
      count < 3 &&
      (!(error instanceof ApiError) ||
        error.status >= StatusCodes.INTERNAL_SERVER_ERROR),
    retryDelay: 1000,
    onError: (error) => {
      toast.error(
        t(error instanceof ApiError ? error.key : "errors:route.description"),
      )

      if (error instanceof ApiError && error.status === StatusCodes.NOT_FOUND) {
        updatePlayer({ inviteCode: null, generatedUsernames: false })
      }
    },
  })

  const handleLogin = () => {
    if (!inviteCode) {
      return
    }

    sessionStorage.setItem(
      "avatar-join",
      JSON.stringify({
        inviteCode,
        username: generatedUsernames ? undefined : username,
      }),
    )
    join({
      inviteCode,
      username: generatedUsernames ? undefined : username,
    })
  }

  useEffect(() => {
    if (resumed.current || !inviteCode) {
      return
    }

    resumed.current = true

    try {
      const saved = JSON.parse(
        sessionStorage.getItem("avatar-join") ?? "null",
      ) as { inviteCode?: string; username?: string } | null

      if (saved?.inviteCode === inviteCode) {
        join({ inviteCode, username: saved.username })
      }
    } catch {
      /* Ignore incomplete browser state. */
    }
  }, [inviteCode, join])

  if (setup && inviteCode) {
    return (
      <AvatarEditor
        setup={setup}
        busy={isPending}
        onComplete={(avatar?: Avatar) =>
          join({
            inviteCode,
            username: generatedUsernames ? undefined : username,
            avatar,
            avatarReady: true,
          })
        }
      />
    )
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleLogin()
    }
  }

  if (generatedUsernames) {
    return (
      <Card>
        <p className="mb-4 text-center text-lg font-semibold">
          {t("game:generatedUsernameNotice")}
        </p>
        <Button onClick={handleLogin} disabled={isPending}>
          {t("common:submit")}
        </Button>
      </Card>
    )
  }

  return (
    <Card>
      <Input
        className="text-center"
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("game:usernamePlaceholder")}
      />
      <Button className="mt-4" onClick={handleLogin} disabled={isPending}>
        {t("common:submit")}
      </Button>
    </Card>
  )
}

export default Username
