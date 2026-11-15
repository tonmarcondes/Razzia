import type { Avatar } from "@razzia/common/avatar"
import { colors } from "./palette"
const AvatarHair = ({ avatar: a }: { avatar: Avatar }) => {
  const hair = colors[a.hairColor]

  return (
    <>
      {a.hair !== "bald" && (
        <g fill={hair}>
          {a.hair === "afro" ? (
            <path d="M12 12h4V8h32v4h4v16h-8V17H20v11h-8z" />
          ) : (
            (() => {
              if (a.hair === "balding") {
                return <path d="M14 18h6v12h-6zm30 0h6v12h-6z" />
              }

              if (a.hair === "mohawk") {
                return <path d="M28 6h8v19h-8z" />
              }

              if (a.hair === "spiky") {
                return (
                  <path d="M14 22V11h5V6h6v4h5V3h6v7h5V7h5v5h5v10H38v-5H25v5z" />
                )
              }

              if (a.hair === "curly") {
                return (
                  <path d="M14 14h5V9h8v3h8V8h9v5h6v11h-7v-5h-8v4h-8v-5h-7v9h-6z" />
                )
              }

              return <path d="M14 14h5v-4h26v4h5v13h-7v-9H21v9h-7z" />
            })()
          )}
          {a.hair === "sideFringe" && <path d="M18 17h25v5H32v5H22v5h-4z" />}
          {a.hair === "bun" && <rect x="24" y="3" width="16" height="10" />}
          {a.hair === "braids" && (
            <path d="M13 20h6v9h-4v9h4v9h-6zm32 0h6v27h-6v-9h4v-9h-4z" />
          )}
        </g>
      )}
    </>
  )
}

export default AvatarHair
