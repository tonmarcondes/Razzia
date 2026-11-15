import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { GameSettings } from "@razzia/common/types/game"
import Switch from "@razzia/web/components/Switch"
import SettingRow from "./SettingRow"
const Avatars = () => {
  const { control, register } = useFormContext<GameSettings>()
  const enabled = useWatch({ control, name: "avatars.enabled" })
  const { t } = useTranslation()

  return (
    <>
      <Controller
        control={control}
        name="avatars.enabled"
        render={({ field }) => (
          <SettingRow label="avatar:enabled" hint="avatar:hint">
            <Switch
              aria-label={t("avatar:enabled")}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </SettingRow>
        )}
      />
      {enabled && (
        <label className="my-4 flex flex-col gap-2 font-semibold">
          {t("avatar:seconds")}
          <input
            aria-label={t("avatar:seconds")}
            type="number"
            required
            min={10}
            max={180}
            className="rounded-lg border p-2"
            {...register("avatars.seconds", { valueAsNumber: true })}
          />
        </label>
      )}
    </>
  )
}

export default Avatars
