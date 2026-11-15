import type { Avatar } from "@razzia/common/avatar"

const AvatarHeadwear = ({ avatar: a }: { avatar: Avatar }) => {
  const headColor =
    (
      {
        panamaBlack: "#272733",
        hardHat: "#efc52f",
        santa: "#d94450",
        crown: "#f7cf4d",
        straw: "#d8b579",
        pilot: "#263752",
        beanie: "#78659f",
      } as Partial<Record<Avatar["hat"], string>>
    )[a.hat] ?? "#f4f4ec"

  return (
    <>
      {a.hat !== "none" && (
        <g fill={headColor}>
          {a.hat === "balaclava" ? (
            <path
              fillRule="evenodd"
              d="M12 11h40v41H12zM18 27v12h28V27zM26 42v7h12v-7z"
            />
          ) : (
            (() => {
              if (a.hat === "crown") {
                return <path d="M14 17V6h6v5h8V4h8v7h8V6h6v15H14z" />
              }

              if (a.hat === "chef") {
                return <path d="M18 15h-5V6h8V2h22v4h8v9h-5v9H18z" />
              }

              if (a.hat === "santa") {
                return (
                  <>
                    <path d="M16 18V9h6V5h20v5h8v7h5v6H43v-7h-3v7z" />
                    <path d="M14 19h34v6H14zm35 0h9v9h-9z" fill="#fff" />
                  </>
                )
              }

              if (a.hat === "nurse") {
                return (
                  <>
                    <path d="M15 10h34l-4 13H20z" />
                    <path
                      d="M30 12h4v3h3v4h-3v3h-4v-3h-3v-4h3z"
                      fill="#459dba"
                    />
                  </>
                )
              }

              if (a.hat === "pilot") {
                return (
                  <>
                    <path d="M12 9h40v10H12zm7 10h26v5H19z" />
                    <path d="M21 15h22v2H21zm8-4h6v3h-6z" fill="#f3cf71" />
                  </>
                )
              }

              if (a.hat === "hardHat") {
                return (
                  <>
                    <path d="M15 18v-7h6V6h22v5h6v7h5v6H10v-6z" />
                    <path d="M29 5h6v16h-6z" fill="#ffe48c" />
                  </>
                )
              }

              if (a.hat === "beanie") {
                return (
                  <>
                    <path d="M16 21V10h5V5h22v5h5v11z" />
                    <path d="M13 18h38v7H13z" />
                    <rect x="27" y="2" width="10" height="6" />
                  </>
                )
              }

              if (a.hat === "cap") {
                return <path d="M16 21V10h7V7h21v5h6v7h6v5H16z" />
              }

              return (
                <>
                  <path d="M19 7h26v13H19zM9 19h46v5H9z" />
                  <rect x="19" y="15" width="26" height="4" fill="#52546a" />
                </>
              )
            })()
          )}
        </g>
      )}
    </>
  )
}

export default AvatarHeadwear
