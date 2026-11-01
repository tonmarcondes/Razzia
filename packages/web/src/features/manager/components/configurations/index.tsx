import ConfigAccounts from "@razzia/web/features/manager/components/configurations/ConfigAccounts"
import {
  accountQuery,
  authConfigQuery,
} from "@razzia/web/features/manager/accounts"
import ConfigAppearance from "@razzia/web/features/manager/components/configurations/ConfigAppearance"
import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import LanguageSwitcher from "@razzia/web/components/LanguageSwitcher"
import { useManagerStore } from "@razzia/web/features/game/stores/manager"
import ConfigManageQuizz from "@razzia/web/features/manager/components/configurations/ConfigManageQuizz"
import ConfigResults from "@razzia/web/features/manager/components/configurations/ConfigResults"
import ConfigSelectQuizz from "@razzia/web/features/manager/components/configurations/ConfigSelectQuizz"
import ConfigTabButton from "@razzia/web/features/manager/components/configurations/ConfigTabButton"
import { managerLogout } from "@razzia/web/features/manager/queries"
import { setToken } from "@razzia/web/lib/session"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { LogOut, Palette, UsersRound } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

const baseTabs = [
  {
    nameKey: "manager:tabs.play",
    component: ConfigSelectQuizz,
  },
  {
    nameKey: "manager:tabs.quizz",
    component: ConfigManageQuizz,
  },
  {
    nameKey: "manager:tabs.results",
    component: ConfigResults,
  },
  { nameKey: "manager:tabs.appearance", component: ConfigAppearance },
]

const Configurations = () => {
  const { data: authConfig } = useQuery(authConfigQuery())
  const { data: me, isError } = useQuery({
    ...accountQuery(),
    enabled: authConfig?.mode === "local",
  })
  const tabs =
    authConfig?.mode === "local"
      ? [
          ...baseTabs.filter(
            (tab) =>
              !me?.user?.mustReset &&
              (tab.nameKey !== "manager:tabs.appearance" ||
                me?.user?.role === "admin"),
          ),
          { nameKey: "manager:tabs.accounts", component: ConfigAccounts },
        ]
      : baseTabs
  const [selectedTab, setSelectedTab] = useState(() => {
    const indexes: Record<string, number> = { "#appearance": 3, "#accounts": 4 }

    return indexes[window.location.hash] ?? 0
  })
  const { resetManager } = useManagerStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const activeIndex = Math.min(selectedTab, tabs.length - 1)
  const TabComponent = tabs[activeIndex].component
  const wide =
    tabs[activeIndex].nameKey === "manager:tabs.appearance" ||
    tabs[activeIndex].nameKey === "manager:tabs.accounts"

  const handleSelect = (index: number) => () => {
    setSelectedTab(index)
    const hashes: Record<string, string> = {
      "manager:tabs.appearance": "#appearance",
      "manager:tabs.accounts": "#accounts",
    }
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}${hashes[tabs[index].nameKey] ?? ""}`,
    )
  }

  const { mutate: logout } = useMutation({
    mutationFn: managerLogout,
    onSuccess: (session) => setToken(session.token),
    onSettled: () => {
      queryClient.clear()
      resetManager()
      navigate({ to: "/manager" })
    },
  })

  if (isError) {
    return (
      <Card>
        <Button onClick={() => window.location.assign("/manager")}>
          {t("manager:accounts.signIn")}
        </Button>
      </Card>
    )
  }

  if (authConfig?.mode === "local" && !me) {
    return <Card>{t("manager:accounts.loading")}</Card>
  }

  return (
    <Card
      className={
        wide
          ? "fixed inset-y-4 left-1/2 z-20 w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2"
          : "max-h-128 w-full max-w-md"
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-lg font-semibold">
          {t("manager:configurationsTitle")}
        </p>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-sm p-1.5"
            onClick={() => logout()}
            title={t("manager:logout")}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
      <div className="bg-muted flex shrink-0 flex-wrap rounded-lg">
        {tabs.map((tab, index) => (
          <ConfigTabButton
            key={tab.nameKey}
            title={t(tab.nameKey)}
            aria-label={t(tab.nameKey)}
            active={index === activeIndex}
            onClick={handleSelect(index)}
          >
            {tab.nameKey === "manager:tabs.appearance" && (
              <Palette className="mx-auto size-5" aria-hidden="true" />
            )}
            {tab.nameKey === "manager:tabs.accounts" && (
              <UsersRound className="mx-auto size-5" aria-hidden="true" />
            )}
            {!["manager:tabs.appearance", "manager:tabs.accounts"].includes(
              tab.nameKey,
            ) && t(tab.nameKey)}
          </ConfigTabButton>
        ))}
      </div>
      <hr className="text-muted my-4 border" />
      <div className="flex min-h-0 flex-1 flex-col">
        <TabComponent />
      </div>
    </Card>
  )
}

export default Configurations
