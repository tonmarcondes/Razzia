import type { ButtonHTMLAttributes, PropsWithChildren } from "react"
import clsx from "clsx"

const ConfigTabButton = ({
  children,
  active,
  ...otherProps
}: ButtonHTMLAttributes<HTMLButtonElement> &
  PropsWithChildren & { active?: boolean }) => (
  <button
    className={clsx(
      "flex-1 rounded-lg px-2 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent sm:px-4 sm:text-base",
      active && "bg-primary text-white hover:bg-primary/90",
    )}
    {...otherProps}
  >
    <div>{children}</div>
  </button>
)

export default ConfigTabButton
