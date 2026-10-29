import clsx from "clsx"
import type { ButtonHTMLAttributes, PropsWithChildren } from "react"

const ConfigTabButton = ({
  children,
  active,
  ...otherProps
}: ButtonHTMLAttributes<HTMLButtonElement> &
  PropsWithChildren & { active?: boolean }) => (
  <button
    className={clsx(
      "text-accent-foreground hover:bg-accent flex-1 rounded-lg px-2 py-2 text-xs font-semibold sm:px-4 sm:text-base",
      active && "bg-primary hover:bg-primary/90 text-white",
    )}
    {...otherProps}
  >
    <div>{children}</div>
  </button>
)

export default ConfigTabButton
