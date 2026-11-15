import type { Avatar } from "@razzia/common/avatar"
import { colors } from "./palette"

const AvatarMouth = ({ avatar: a }: { avatar: Avatar }) => {
  if (a.mouth === "pacifier") {
    return (
      <g>
        <path d="M21 42h22v9h-4v3H25v-3h-4z" fill="#f4a6ce" />
        <path d="M23 44h4v5h-4zm14 0h4v5h-4z" fill="#d65d98" />
        <rect x="28" y="44" width="8" height="7" fill="#f9d767" />
        <path d="M28 50h8v8h-8z" fill="none" stroke="#f9d767" strokeWidth="3" />
      </g>
    )
  }

  if (a.mouth === "zipper") {
    return (
      <g>
        <rect x="22" y="43" width="19" height="5" fill="#39465b" />
        <path
          d="M24 43v3m3-1v3m3-5v3m3-1v3m3-5v3"
          stroke="#dce5ed"
          strokeWidth="2"
        />
        <rect x="39" y="42" width="4" height="7" fill="#f0c55a" />
        <path d="M40 49h3v5h-3z" fill="none" stroke="#f0c55a" strokeWidth="2" />
      </g>
    )
  }

  return (
    <>
      <g fill={a.lipstick === "none" ? "#713d44" : colors[a.lipstick]}>
        {a.mouth === "smile" ? (
          <path d="M25 43h3v2h8v-2h3v4H25z" />
        ) : (
          (() => {
            if (a.mouth === "smirk") {
              return <path d="M29 44h10v-3h2v5H29z" />
            }

            if (a.mouth === "yawn" || a.mouth === "surprised") {
              return (
                <rect
                  x="28"
                  y="41"
                  width="8"
                  height={a.mouth === "yawn" ? 9 : 7}
                />
              )
            }

            return <rect x="24" y="42" width="16" height="7" />
          })()
        )}
      </g>
      {["missingTooth", "dirtyTooth"].includes(a.mouth) && (
        <>
          <rect x="25" y="42" width="14" height="3" fill="#fff" />
          <rect
            x={a.mouth === "missingTooth" ? 29 : 34}
            y="42"
            width="3"
            height="3"
            fill={a.mouth === "missingTooth" ? "#713d44" : "#a18c59"}
          />
        </>
      )}
      {a.mouth === "tongue" && (
        <rect x="30" y="46" width="6" height="5" fill="#ed7e99" />
      )}
      {a.mouth === "gum" && (
        <>
          <rect x="28" y="40" width="16" height="14" fill="#f19ecb" />
          <path d="M30 42h4v2h-4z" fill="#ffd7ed" />
        </>
      )}
    </>
  )
}

export default AvatarMouth
