import defaultLogo from "@razzia/web/assets/logo.svg"
import { getBranding, imageFallback } from "@razzia/web/branding"
import GithubIcon from "@razzia/web/components/GithubIcon"
import type { PropsWithChildren } from "react"

const Background = ({ children }: PropsWithChildren) => {
  const branding = getBranding()
  const background = branding?.backgrounds?.home ?? branding?.background
  const logo = branding?.logo ?? defaultLogo
  const appName = branding?.appName ?? "Razzia"

  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center">
      <div className="absolute h-full max-h-svh w-full overflow-hidden">
        <div className="bg-primary/15 absolute top-[-70vmin] left-[-50vmin] min-h-[120vmin] min-w-[120vmin] rotate-20 rounded-4xl" />
        <div className="bg-primary/15 absolute right-[-10vmin] bottom-[-45vmin] min-h-[75vmin] min-w-[75vmin] rotate-20 rounded-4xl" />
      </div>

      {background && (
        <img
          src={background}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}
      {branding?.appName && !branding.logo ? (
        <h1 className="text-primary relative mb-10 max-w-full px-4 text-center text-4xl font-black break-words sm:text-6xl">
          {appName}
        </h1>
      ) : (
        <img
          src={logo}
          onError={imageFallback(defaultLogo)}
          className="relative mb-10 h-16 max-w-full object-contain"
          alt={appName}
        />
      )}
      {children}

      <a
        href="https://github.com/Ralex91/Razzia"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 text-sm font-semibold text-white/50 transition-colors hover:text-white/80"
      >
        <GithubIcon size={14} />
        {/* oxlint-disable-next-line no-undef */}
        Razzia - v{__APP_VERSION__}
      </a>
    </section>
  )
}

export default Background
