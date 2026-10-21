import { AUBE_GRADIENT, COLORS, LOADER_VIEWBOX, MARK_PATH, VIEWBOX } from "../geometry.js"

const SIZES = new Set(["compact", "standard", "large"])
const THEMES = new Set(["light", "dark", "aube", "current"])

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;"
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case '"':
        return "&quot;"
      default:
        return "&#39;"
    }
  })
}

function aubeDefs(id) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${COLORS.aubeFrom}"/><stop offset="1" stop-color="${COLORS.aubeTo}"/></linearGradient></defs>`
}

/**
 * Horizontal loader: elastic symbol, fixed “scenaro”, optional status line.
 * Host must include brand/scenaro-loader.css and the local Sora file.
 * Unmount this markup when the wait ends; do not hold for the 3s loop.
 *
 * @param {{ size?: "compact"|"standard"|"large", theme?: "light"|"dark"|"aube"|"current", label?: string, busy?: boolean, id?: string }} options
 */
export function scenaroLoaderMarkup(options = {}) {
  const size = SIZES.has(options.size) ? options.size : "standard"
  const theme = THEMES.has(options.theme) ? options.theme : "current"
  const label = options.label ? escapeHtml(options.label) : ""
  const busy = options.busy !== false
  const gradientId = escapeHtml(options.id || "scenaro-aube")
  const fill = theme === "aube" ? `url(#${gradientId})` : "currentColor"
  const defs = theme === "aube" ? aubeDefs(gradientId) : ""
  const wordHidden = label ? ` aria-hidden="true"` : ""
  const labelHtml = label ? `<span class="scenaro-loader__label">${label}</span>` : ""

  return `<div class="scenaro-loader scenaro-loader--${size} scenaro-loader--${theme}" role="status" aria-live="polite" aria-busy="${busy ? "true" : "false"}"><span class="scenaro-loader__row"><svg class="scenaro-loader__mark scenaro-mark--elastic" xmlns="http://www.w3.org/2000/svg" viewBox="${LOADER_VIEWBOX}" overflow="visible" aria-hidden="true">${defs}<g class="scenaro-mark__spring"><path fill="${fill}" fill-rule="evenodd" d="${MARK_PATH}"/></g></svg><span class="scenaro-loader__word"${wordHidden}>scenaro</span></span>${labelHtml}</div>`
}

/**
 * @param {{ size?: "compact"|"standard"|"large", theme?: "light"|"dark"|"aube"|"current", id?: string }} options
 */
export function scenaroLockupMarkup(options = {}) {
  const size = SIZES.has(options.size) ? options.size : "standard"
  const theme = THEMES.has(options.theme) ? options.theme : "current"
  const gradientId = escapeHtml(options.id || "scenaro-aube-lockup")
  const fill = theme === "aube" ? `url(#${gradientId})` : "currentColor"
  const defs = theme === "aube" ? aubeDefs(gradientId) : ""

  return `<span class="scenaro-lockup scenaro-lockup--${size} scenaro-lockup--${theme}"><svg class="scenaro-lockup__mark" xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" aria-hidden="true">${defs}<path fill="${fill}" fill-rule="evenodd" d="${MARK_PATH}"/></svg><span class="scenaro-lockup__word">scenaro</span></span>`
}

export { AUBE_GRADIENT, COLORS, LOADER_VIEWBOX, MARK_PATH, VIEWBOX }
