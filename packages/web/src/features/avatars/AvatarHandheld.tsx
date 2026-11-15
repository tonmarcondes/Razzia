import type { Avatar } from "@razzia/common/avatar"
import { skinColors } from "./palette"
const AvatarHandheld = ({ avatar: a }: { avatar: Avatar }) => {
  const skin = skinColors[a.skin]

  return (
    <>
      {a.hand !== "none" && (
        <g transform="translate(45 60)">
          <rect x="0" y="7" width="8" height="11" fill={skin} />
          {a.hand === "coffee" ? (
            <>
              <path d="M-2 3h12v12H-2zM10 5h4v7h-4z" fill="#f4e4ce" />
              <path d="M0 3h8v3H0z" fill="#68402f" />
            </>
          ) : (
            (() => {
              if (a.hand === "bottle") {
                return (
                  <>
                    <path d="M3-8h5v5H3z" fill="#edbd87" />
                    <path d="M0-3h11v4H0z" fill="#78bfe0" />
                    <path d="M0 1h11v16H0z" fill="#e1f3f7" />
                    <path d="M1 6h9v10H1z" fill="#fff5d8" />
                    <path d="M1 4h3m-3 4h3m-3 4h3" stroke="#6e9fae" />
                  </>
                )
              }

              if (a.hand === "plane") {
                return (
                  <path
                    d="M4 0h3v7l8 4v3l-8-2v5H4v-5l-7 2v-3l7-4z"
                    fill="#dfe9f2"
                  />
                )
              }

              if (a.hand === "controller") {
                return (
                  <>
                    <path d="M-3 4h18v11H-3z" fill="#4c4970" />
                    <path
                      d="M0 7h6v2H0zm2-2h2v6H2zm9 2h2v2h-2z"
                      fill="#e7d28b"
                    />
                  </>
                )
              }

              if (["book", "checklist", "multimeter"].includes(a.hand)) {
                return (
                  <>
                    <rect
                      x="-1"
                      y="0"
                      width="12"
                      height="17"
                      fill={(() => {
                        if (a.hand === "multimeter") {
                          return "#efd05d"
                        }

                        if (a.hand === "book") {
                          return "#c9675c"
                        }

                        return "#d4b38b"
                      })()}
                    />
                    <rect x="1" y="3" width="8" height="7" fill="#e6f0e9" />
                    <path
                      d="M2 5h6M2 8h6m-6 5h6"
                      stroke="#58728c"
                      strokeWidth="1"
                    />
                    {a.hand === "multimeter" && (
                      <rect x="4" y="12" width="4" height="4" fill="#344259" />
                    )}
                  </>
                )
              }

              if (a.hand === "flashlight") {
                return (
                  <>
                    <path d="M1 1h10v5H1zm2 5h6v12H3z" fill="#f0cf59" />
                    <rect x="2" y="0" width="8" height="2" fill="#f6ffe5" />
                  </>
                )
              }

              if (a.hand === "screwdriver") {
                return (
                  <>
                    <rect x="4" y="-3" width="3" height="12" fill="#d8e2e9" />
                    <rect x="2" y="8" width="7" height="10" fill="#ce585d" />
                  </>
                )
              }

              if (a.hand === "pliers") {
                return (
                  <>
                    <path d="M0-1h3v6h5v-6h3v9H0z" fill="#cedbe2" />
                    <path
                      d="m1 8 2 10h3L4 8zm6 0L5 18h3l2-10z"
                      fill="#ce585d"
                    />
                  </>
                )
              }

              return (
                <>
                  <path
                    d={
                      a.hand === "spanner"
                        ? "M0-3h3v4h5v-4h3v8H8v8h3v8H8v-4H3v4H0v-8h4V5H0z"
                        : "M1-3h3v5h4v-5h3v9H8v12H4V6H1z"
                    }
                    fill="#d1dce6"
                  />
                </>
              )
            })()
          )}
        </g>
      )}
    </>
  )
}

export default AvatarHandheld
