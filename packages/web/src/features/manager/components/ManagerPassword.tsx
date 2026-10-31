import Button from "@razzia/web/components/Button"
import Card from "@razzia/web/components/Card"
import Input from "@razzia/web/components/Input"
import { type KeyboardEvent, useState } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  onSubmit: (_password: string, _login?: string) => void
  local?: boolean
  disabled?: boolean
}

const ManagerPassword = ({ onSubmit, disabled, local }: Props) => {
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const { t } = useTranslation()

  const handleSubmit = () => {
    if (disabled) {
      return
    }

    onSubmit(password, login)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSubmit()
    }
  }

  return (
    <Card>
      {local && (
        <label>
          {t("manager:accounts.login")}
          <Input
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </label>
      )}
      <Input
        type="password"
        autoComplete="current-password"
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("manager:passwordPlaceholder")}
      />
      <Button className="mt-4" onClick={handleSubmit}>
        {t("common:submit")}
      </Button>
    </Card>
  )
}

export default ManagerPassword
