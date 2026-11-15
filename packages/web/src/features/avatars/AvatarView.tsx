import { memo } from "react"
import type { Avatar } from "@razzia/common/avatar"
import { getBranding } from "@razzia/web/branding"
import AvatarHair from "./AvatarHair"
import AvatarHandheld from "./AvatarHandheld"
import AvatarHeadwear from "./AvatarHeadwear"
import { skinColors, colors } from "./palette"
const AvatarView = ({
  avatar: a,
  className = "size-14",
  label = "Avatar",
}: {
  avatar: Avatar
  className?: string
  label?: string
}) => {
  const skin = skinColors[a.skin],
    hair = colors[a.hairColor],
    shirt = (() => {
      if (a.clothes === "uniformNavy" || a.clothes === "vest") {
        return colors.navy
      }

      if (a.clothes === "uniformGrey") {
        return colors.grey
      }

      return colors[a.clothesColor]
    })()
  const uniform = ["uniformNavy", "uniformGrey", "vest"].includes(a.clothes)
  const logo = getBranding()?.logo

  return (
    <svg
      viewBox="0 0 64 80"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={className}
      style={{ imageRendering: "pixelated" }}
    >
      <rect x="2" y="2" width="60" height="76" rx="5" fill="#293b59" />
      <path
        d="M6 10h6v6H6zM51 8h4v4h-4zM7 43h3v3H7z"
        fill="#ffffff"
        opacity=".15"
      />
      {a.clothes === "hoodie" && <path d="M12 44V23h40v21z" fill={shirt} />}
      {["long", "braids", "bob"].includes(a.hair) && (
        <path
          d={a.hair === "bob" ? "M13 19h38v29H13z" : "M13 19h38v38H13z"}
          fill={hair}
        />
      )}
      <path d="M9 59h8v-5h30v5h8v20H9z" fill={shirt} />
      <path d="M25 48h14v14H25z" fill={skin} />
      <path d="M25 48h14v7H25z" fill="#000" opacity=".12" />
      {a.clothes === "plaid" && (
        <g stroke="#fff" strokeOpacity=".3" strokeWidth="2">
          <path d="M18 56v22m10-22v22m10-22v22m10-22v22M9 64h46M9 73h46" />
        </g>
      )}
      {a.clothes === "hoodie" && (
        <path
          d="m20 55 12 9 12-9M26 62v10m12-10v10"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeOpacity=".6"
        />
      )}
      {uniform && (
        <>
          <path
            d="m23 55 9 8 9-8M32 63v16"
            fill="none"
            stroke="#72839c"
            strokeWidth="2"
          />
          <rect x="39" y="63" width="9" height="5" fill="#eef3ff" />
          {logo ? (
            <image
              href={logo}
              x="39"
              y="63"
              width="9"
              height="5"
              preserveAspectRatio="xMidYMid meet"
            />
          ) : (
            <path d="m40 64 3 2 4-2v2l-4 2-3-2z" fill="#667ab5" />
          )}
        </>
      )}
      {a.clothes === "vest" && (
        <>
          <path d="M13 58h8v21H9V61zm30 0h8l4 3v18H43z" fill="#f04a54" />
          <path
            d="M12 63h8v4h-8zm32 0h8v4h-8zM9 73h12v4H9zm34 0h12v4H43z"
            fill="#dcebc8"
          />
        </>
      )}
      <path
        d={
          a.ears === "large"
            ? "M7 26h10v17H7zm40 0h10v17H47z"
            : "M12 28h6v11h-6zm34 0h6v11h-6z"
        }
        fill={skin}
      />
      <path d="M16 16h32v31h-4v5H20v-5h-4z" fill={skin} />
      <path d="M16 18h4v26h-4zm28 0h4v26h-4z" fill="#000" opacity=".06" />
      {a.detail === "acne" && (
        <path
          d="M22 21h2v2h-2zm13 2h2v2h-2zM19 38h2v2h-2zm22 2h2v2h-2z"
          fill="#bb5d5c"
        />
      )}
      {a.detail === "freckles" && (
        <path
          d="M19 37h2v2h-2zm4 2h2v2h-2zm-2-5h2v2h-2zm18 3h2v2h-2zm4-2h2v2h-2zm-2 5h2v2h-2z"
          fill="#845f43"
        />
      )}
      {a.detail === "darkCircles" && (
        <path d="M21 34h7v3h-7zm15 0h7v3h-7z" fill="#745d74" />
      )}
      {a.detail === "blush" && (
        <path d="M18 37h8v3h-8zm20 0h8v3h-8z" fill="#e17d86" />
      )}
      {a.shadow !== "none" && (
        <path d="M20 28h9v4h-9zm15 0h9v4h-9z" fill={colors[a.shadow]} />
      )}
      <g fill="#302737">
        {(() => {
          if (a.brows === "unibrow") {
            return <rect x="21" y="25" width="22" height="3" />
          }

          if (a.brows === "angry") {
            return <path d="m20 23 9 3v3l-9-3zm15 3 9-3v3l-9 3z" />
          }

          return (
            <>
              <rect
                x="21"
                y="25"
                width={a.brows === "slit" ? 5 : 8}
                height={a.brows === "thick" ? 4 : 2}
              />
              <rect
                x="35"
                y="25"
                width="8"
                height={a.brows === "thick" ? 4 : 2}
              />
              {a.brows === "slit" && (
                <rect x="28" y="25" width="2" height="2" />
              )}
            </>
          )
        })()}
      </g>
      {(() => {
        if (a.eyes === "hearts") {
          return (
            <path
              d="M20 30h3v2h2v-2h3v5h-2v2h-3v-2h-3zm15 0h3v2h2v-2h3v5h-2v2h-3v-2h-3z"
              fill="#db426b"
            />
          )
        }

        if (a.eyes === "sleepy") {
          return <path d="M21 32h8v2h-8zm14 0h8v2h-8z" fill="#302737" />
        }

        return (
          <>
            <rect
              x="21"
              y="30"
              width="8"
              height={a.eyes === "surprised" ? 8 : 5}
              fill="#fff"
            />
            {a.eyes === "wink" ? (
              <path d="m35 32 7-2v2l-7 2z" fill="#302737" />
            ) : (
              <rect
                x="35"
                y="30"
                width="8"
                height={(() => {
                  if (a.eyes === "surprised") {
                    return 8
                  }

                  if (a.eyes === "confused") {
                    return 3
                  }

                  return 5
                })()}
                fill="#fff"
              />
            )}
            <rect
              x="25"
              y="31"
              width="3"
              height={a.eyes === "surprised" ? 6 : 4}
              fill="#33334d"
            />
            {a.eyes !== "wink" && (
              <rect
                x="36"
                y="31"
                width="3"
                height={a.eyes === "surprised" ? 6 : 3}
                fill="#33334d"
              />
            )}
          </>
        )
      })()}
      <path d="M30 35h4v5h-4z" fill="#000" opacity=".1" />
      {a.detail === "noseBandage" && (
        <g>
          <rect x="26" y="36" width="12" height="4" fill="#e8d7b1" />
          <path d="M29 37h1v1h-1zm5 0h1v1h-1z" fill="#ab9475" />
        </g>
      )}
      {a.detail === "cheekBandage" && (
        <rect x="39" y="38" width="8" height="4" fill="#e8d7b1" />
      )}
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
      {a.glasses !== "none" && (
        <g
          fill={a.glasses === "sun" ? "#243148" : "none"}
          stroke={a.glasses === "safety" ? "#f6c84c" : "#344259"}
          strokeWidth="2"
        >
          <rect
            x="18"
            y="29"
            width="13"
            height="9"
            rx={a.glasses === "round" ? 4 : 0}
          />
          <rect
            x="33"
            y="29"
            width="13"
            height="9"
            rx={a.glasses === "round" ? 4 : 0}
          />
          <path d="M31 32h2m-19 0h4m28 0h4" />
        </g>
      )}
      <AvatarHair avatar={a} />
      {a.earrings !== "none" && (
        <g
          fill={a.earrings === "studs" ? "#f4d16b" : "none"}
          stroke="#f4d16b"
          strokeWidth="2"
        >
          <rect
            x="11"
            y="38"
            width={a.earrings === "studs" ? 2 : 5}
            height={a.earrings === "studs" ? 2 : 7}
          />
          <rect
            x="48"
            y="38"
            width={a.earrings === "studs" ? 2 : 5}
            height={a.earrings === "studs" ? 2 : 7}
          />
        </g>
      )}
      {a.headset === "head" && (
        <g fill="#303a52">
          <path d="M10 18v-7h6V7h32v4h6v22h-5V16h-4v-4H19v4h-4v17h-5z" />
          <rect x="9" y="27" width="7" height="12" />
          <rect x="48" y="27" width="7" height="12" />
          <path d="M51 37v6H39v-3h9v-3z" />
        </g>
      )}
      {a.headset === "neck" && (
        <g fill="#303a52">
          <path d="M20 53h4v10h16V53h4v14H20z" />
          <rect x="17" y="56" width="9" height="12" />
          <rect x="38" y="56" width="9" height="12" />
        </g>
      )}
      <AvatarHeadwear avatar={a} />
      {a.badge === "badge" && (
        <>
          <path
            d="m23 55 6 14h6l6-14"
            fill="none"
            stroke="#688bcf"
            strokeWidth="2"
          />
          <rect x="28" y="68" width="9" height="10" fill="#f2f5fa" />
          <rect x="30" y="70" width="5" height="4" fill="#688bcf" />
        </>
      )}
      {a.neck === "gold" && (
        <path
          d="m22 55 3 9h14l3-9m-10 9v5"
          fill="none"
          stroke="#f2c54d"
          strokeWidth="3"
        />
      )}
      {a.neck === "stethoscope" && (
        <>
          <path
            d="M24 55v10q0 8 8 8t8-8V55m-8 18v4h11V66"
            fill="none"
            stroke="#9cd2e2"
            strokeWidth="2"
          />
          <rect x="40" y="63" width="7" height="7" fill="#d6e4ed" />
        </>
      )}
      <AvatarHandheld avatar={a} />
    </svg>
  )
}

export default memo(AvatarView)
