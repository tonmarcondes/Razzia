import { SESSION_ROLES } from "@razzia/common/constants"
import ManagerPassword from "@razzia/web/features/manager/components/ManagerPassword"
import { managerLogin } from "@razzia/web/features/manager/queries"
import { ApiError } from "@razzia/web/lib/api"
import { getRole, setToken } from "@razzia/web/lib/session"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

import {
  authConfigQuery,
  loginAccount,
} from "@razzia/web/features/manager/accounts"

const ManagerAuthPage = () => {
  const client = useQueryClient()
  const { data: config } = useQuery(authConfigQuery())
  const navigate = useNavigate()
  const { t } = useTranslation()

  const { mutate, isPending } = useMutation({
    mutationFn: ({ password, login }: { password: string; login?: string }) =>
      config?.mode === "local"
        ? loginAccount({ login: login ?? "", password })
        : managerLogin(password),
    onSuccess: (session) => {
      client.clear()
      setToken(session.token)
      navigate({ to: "/manager/config" })
    },
    onError: (error) => {
      toast.error(
        t(error instanceof ApiError ? error.key : "errors:route.description"),
      )
    },
  })

  return (
    <ManagerPassword
      local={config?.mode === "local"}
      onSubmit={(password, login) => mutate({ password, login })}
      disabled={isPending || !config}
    />
  )
}

export const Route = createFileRoute("/(auth)/manager/")({
  beforeLoad: () => {
    if (getRole() === SESSION_ROLES.MANAGER) {
      // oxlint-disable-next-line typescript/only-throw-error
      throw redirect({ to: "/manager/config" })
    }
  },
  component: ManagerAuthPage,
})
