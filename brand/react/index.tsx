"use client"

import { useId, type CSSProperties, type ReactNode } from "react"
import { COLORS, LOADER_VIEWBOX, MARK_PATH, VIEWBOX } from "../geometry.js"

export type ScenaroTheme = "light" | "dark" | "aube" | "current"
export type ScenaroSize = "compact" | "standard" | "large"

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

function themeStyle(theme: ScenaroTheme): CSSProperties | undefined {
  if (theme === "light") return { color: COLORS.ink }
  if (theme === "dark") return { color: COLORS.cream }
  return undefined
}

function MarkPaths({ theme, gradientId, elastic }: { theme: ScenaroTheme; gradientId: string; elastic?: boolean }) {
  const fill = theme === "aube" ? `url(#${gradientId})` : "currentColor"
  const path = <path fill={fill} fillRule="evenodd" d={MARK_PATH} />
  return (
    <>
      {theme === "aube" ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={COLORS.aubeFrom} />
            <stop offset="1" stopColor={COLORS.aubeTo} />
          </linearGradient>
        </defs>
      ) : null}
      {elastic ? <g className="scenaro-mark__spring">{path}</g> : path}
    </>
  )
}

/** Asymmetric ring. Decorative by default. */
export function ScenaroMark({
  theme = "current",
  className,
  elastic = false,
  title,
}: {
  theme?: ScenaroTheme
  className?: string
  elastic?: boolean
  title?: string
}) {
  const gradientId = useId().replace(/:/g, "")
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={elastic ? LOADER_VIEWBOX : VIEWBOX}
      overflow="visible"
      className={cx(elastic && "scenaro-mark--elastic", className)}
      style={theme === "light" || theme === "dark" ? themeStyle(theme) : undefined}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <MarkPaths theme={theme} gradientId={`scenaro-mark-${gradientId}`} elastic={elastic} />
    </svg>
  )
}

/** “scenar” in Sora 700, with the ring as the final o. */
export function ScenaroLockup({
  theme = "current",
  size = "standard",
  className,
}: {
  theme?: ScenaroTheme
  size?: ScenaroSize
  className?: string
}) {
  return (
    <span
      className={cx("scenaro-lockup", `scenaro-lockup--${size}`, `scenaro-lockup--${theme}`, className)}
      style={themeStyle(theme)}
      role="img"
      aria-label="scenaro"
    >
      <span className="scenaro-lockup__word" aria-hidden="true">
        scenar
      </span>
      <ScenaroMark theme={theme} className="scenaro-lockup__mark" />
    </span>
  )
}

/**
 * Wordmark with the ring as an elastic o. The letters stay still.
 * Pass a translated label. Remove the component when loading finishes.
 */
export function ScenaroLoader({
  theme = "current",
  size = "standard",
  label,
  busy = true,
  className,
}: {
  theme?: ScenaroTheme
  size?: ScenaroSize
  label?: ReactNode
  busy?: boolean
  className?: string
}) {
  return (
    <div
      className={cx("scenaro-loader", `scenaro-loader--${size}`, `scenaro-loader--${theme}`, className)}
      style={themeStyle(theme)}
      role="status"
      aria-live="polite"
      aria-busy={busy}
    >
      <span className="scenaro-loader__row">
        <span className="scenaro-loader__word" aria-hidden="true">
          scenar
        </span>
        <ScenaroMark theme={theme} elastic className="scenaro-loader__mark" />
      </span>
      {label ? <span className="scenaro-loader__label">{label}</span> : <span className="scenaro-visually-hidden">scenaro</span>}
    </div>
  )
}
