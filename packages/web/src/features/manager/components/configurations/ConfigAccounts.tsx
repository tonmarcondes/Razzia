import type { AccountPublic } from "@razzia/common/validators/accounts"
import Button from "@razzia/web/components/Button"
import Input from "@razzia/web/components/Input"
import {
  accountQuery,
  authConfigQuery,
  changePassword,
  createAccount,
  resetAccount,
  updateAccount,
  updateProfile,
  usersQuery,
} from "@razzia/web/features/manager/accounts"
import { ApiError } from "@razzia/web/lib/api"
import { setToken } from "@razzia/web/lib/session"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const AccountAdministration = () => {
  const { t } = useTranslation()
  const client = useQueryClient()
  const { data } = useQuery(usersQuery())
  const [login, setLogin] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<AccountPublic["role"]>("teacher")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<AccountPublic | null>(null)
  const [reset, setReset] = useState<AccountPublic | null>(null)
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)

    try {
      await action()
      setPassword("")
      setReset(null)
      setEditing(null)
      await client.invalidateQueries({ queryKey: ["users"] })
      await client.invalidateQueries({ queryKey: ["current-account"] })
      toast.success(t("manager:accounts.saved"))
    } catch (error) {
      toast.error(
        t(error instanceof ApiError ? error.key : "errors:route.description"),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3" aria-label={t("manager:accounts.users")}>
      <h3 className="font-semibold">{t("manager:accounts.users")}</h3>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          void run(() => {
            if (editing) {
              return updateAccount(editing.id, {
                login,
                displayName: name,
                role,
                active: editing.active,
              })
            }

            if (reset) {
              return resetAccount(reset.id, password)
            }

            return createAccount({ login, displayName: name, role, password })
          })
        }}
      >
        {reset ? (
          <p>{t("manager:accounts.resetFor", { name: reset.displayName })}</p>
        ) : (
          <>
            <label className="block">
              {t("manager:accounts.login")}
              <Input
                className="mt-1 block w-full"
                autoComplete="off"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </label>
            <label className="block">
              {t("manager:accounts.name")}
              <Input
                className="mt-1 block w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="block">
              {t("manager:accounts.role")}
              <select
                className="bg-background border-input w-full rounded border p-2"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as AccountPublic["role"])
                }
              >
                <option value="teacher">{t("manager:accounts.teacher")}</option>
                <option value="admin">{t("manager:accounts.admin")}</option>
              </select>
            </label>
          </>
        )}
        {!editing && (
          <label className="block">
            {t("manager:accounts.temporaryPassword")}
            <Input
              className="mt-1 block w-full"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
        )}
        <Button disabled={busy}>
          {editing
            ? t("common:save")
            : t(reset ? "manager:accounts.reset" : "manager:accounts.create")}
        </Button>
        {(reset ?? editing) && (
          <Button
            type="button"
            onClick={() => {
              setReset(null)
              setEditing(null)
              setPassword("")
            }}
          >
            {t("common:cancel")}
          </Button>
        )}
      </form>
      <ul className="space-y-3">
        {data?.users.map((user) => (
          <li className="rounded border p-2" key={user.id}>
            <p className="break-words">
              {user.displayName} ({user.login}) —{" "}
              {t(`manager:accounts.${user.role}`)} —{" "}
              {t(
                user.active
                  ? "manager:accounts.active"
                  : "manager:accounts.disabled",
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => {
                  setEditing(user)
                  setReset(null)
                  setLogin(user.login)
                  setName(user.displayName)
                  setRole(user.role)
                  setPassword("")
                }}
              >
                {t("manager:accounts.edit")}
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    updateAccount(user.id, {
                      displayName: user.displayName,
                      role: user.role,
                      active: !user.active,
                    }),
                  )
                }
              >
                {t(
                  user.active
                    ? "manager:accounts.disable"
                    : "manager:accounts.enable",
                )}
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    updateAccount(user.id, {
                      displayName: user.displayName,
                      role: user.role === "admin" ? "teacher" : "admin",
                      active: user.active,
                    }),
                  )
                }
              >
                {t(
                  user.role === "admin"
                    ? "manager:accounts.makeTeacher"
                    : "manager:accounts.makeAdmin",
                )}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  setReset(user)
                  setEditing(null)
                  setPassword("")
                }}
              >
                {t("manager:accounts.reset")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

const ProfileEditor = ({ user }: { user: AccountPublic }) => {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [login, setLogin] = useState(user.login)
  const [name, setName] = useState(user.displayName)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  return (
    <section className="space-y-3" aria-label={t("manager:accounts.profile")}>
      <h3 className="font-semibold">{t("manager:accounts.profile")}</h3>
      <form
        className="space-y-2"
        onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)

          try {
            await updateProfile({
              login,
              displayName: name,
              currentPassword: password,
            })
            setPassword("")
            await client.invalidateQueries({ queryKey: ["current-account"] })
            await client.invalidateQueries({ queryKey: ["users"] })
            toast.success(t("manager:accounts.saved"))
          } catch (error) {
            toast.error(
              t(
                error instanceof ApiError
                  ? error.key
                  : "errors:route.description",
              ),
            )
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="block">
          {t("manager:accounts.login")}
          <Input
            className="mt-1 block w-full"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="block">
          {t("manager:accounts.name")}
          <Input
            className="mt-1 block w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
        </label>
        <label className="block">
          {t("manager:accounts.profilePassword")}
          <Input
            className="mt-1 block w-full"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <Button disabled={busy}>{t("manager:accounts.saveProfile")}</Button>
      </form>
    </section>
  )
}

const ConfigAccounts = () => {
  const { t } = useTranslation()
  const { data: me } = useQuery(accountQuery())
  const { data: config } = useQuery(authConfigQuery())
  const [current, setCurrent] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (password !== confirmation) {
      toast.error(t("errors:accounts.passwordMismatch"))

      return
    }

    setBusy(true)

    try {
      const response = await changePassword({
        currentPassword: current,
        password,
      })
      setToken(response.token)
      window.location.assign("/manager")
    } catch (error) {
      toast.error(
        t(error instanceof ApiError ? error.key : "errors:route.description"),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-0 space-y-5 overflow-auto p-1">
      <p>{me?.user?.displayName}</p>
      {me?.user && !me.user.mustReset && (
        <ProfileEditor key={me.user.id + me.user.login} user={me.user} />
      )}
      {me?.user?.mustReset && (
        <p role="alert">{t("manager:accounts.changeRequired")}</p>
      )}
      <p>
        {t("manager:accounts.policy", {
          min: config?.passwordPolicy.minLength ?? 15,
        })}
      </p>
      {config?.passwordPolicy && (
        <p>
          {["upper", "lower", "digit", "symbol"]
            .filter(
              (key) =>
                config.passwordPolicy[
                  key as "upper" | "lower" | "digit" | "symbol"
                ],
            )
            .map((key) => t(`manager:accounts.${key}`))
            .join(", ")}
        </p>
      )}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label className="block">
          {t("manager:accounts.currentPassword")}
          <Input
            className="mt-1 block w-full"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label className="block">
          {t("manager:accounts.newPassword")}
          <Input
            className="mt-1 block w-full"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="block">
          {t("manager:accounts.confirmPassword")}
          <Input
            className="mt-1 block w-full"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
          />
        </label>
        <Button disabled={busy}>{t("manager:accounts.changePassword")}</Button>
      </form>
      {me?.user?.role === "admin" && !me.user.mustReset && (
        <AccountAdministration />
      )}
    </div>
  )
}

export default ConfigAccounts
