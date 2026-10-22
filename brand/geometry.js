/** Single asymmetric ring. Do not fork this path in applications. */
export const MARK_PATH =
  "M80 9 A70 61 0 1 1 80 131 A70 61 0 1 1 80 9 Z M90.5 18.5 A51.5 46 0 1 0 90.5 110.5 A51.5 46 0 1 0 90.5 18.5 Z"

/** Logo geometry. The animated loader uses LOADER_VIEWBOX so the rebound is not clipped. */
export const VIEWBOX = "0 0 160 140"

/** Same user coordinates as VIEWBOX, with padding around the 1.08 scale rebound. */
export const LOADER_VIEWBOX = "-18 -16 196 172"

export const WORDMARK = "scenaro"

/** Letters drawn in Sora. The final o is the ring, not a glyph. */
export const WORDMARK_STEM = "scenar"

/**
 * Ring as the o of Sora 700 at letter-spacing -0.04em.
 * Outer ring height matches the o glyph (586/1000 em). Side bearings match that glyph.
 */
export const O_MARK = {
  widthEm: 0.7685,
  heightEm: 0.6725,
  marginLeftEm: -0.049,
  translateYEm: 0.062,
}

export const COLORS = {
  ink: "#2e2b35",
  night: "#0f0e12",
  cream: "#f4f0eb",
  canvas: "#faf9f7",
  aubeFrom: "#f2c94c",
  aubeTo: "#eb6eaf",
}

/** CSS linear-gradient(135deg) — yellow at the top-left, pink at the bottom-right. */
export const AUBE_GRADIENT = `linear-gradient(135deg, ${COLORS.aubeFrom}, ${COLORS.aubeTo})`

export const ELASTIC = {
  name: "scenaro-elastic",
  duration: "3s",
  easing: "ease-in-out",
  origin: "80px 125px",
}

export const SIZES = {
  compact: { wordPx: 15, markWidthEm: O_MARK.widthEm, markHeightEm: O_MARK.heightEm },
  standard: { wordPx: 22, markWidthEm: O_MARK.widthEm, markHeightEm: O_MARK.heightEm },
  large: { wordPx: 36, markWidthEm: O_MARK.widthEm, markHeightEm: O_MARK.heightEm },
}
