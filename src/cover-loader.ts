import { MARK_PATH, VIEWBOX } from '../brand/geometry.js';
import { scenaroLoaderMarkup } from '../brand/html/loader.js';

export type CoverSize = 'compact' | 'standard' | 'large';

/**
 * Sora Latin 700. Copyright 2019 The Sora Project Authors.
 * Licensed under the SIL Open Font License 1.1. See brand/fonts/OFL.txt.
 */
function soraDataUri(): string {
  const base64 = __SCENARO_SORA_WOFF2__;
  if (typeof base64 !== 'string' || base64.length < 1000) {
    throw new Error('Scenaro Sora font was not inlined');
  }
  return `data:font/woff2;base64,${base64}`;
}

function inlinedLoaderCss(): string {
  const uri = soraDataUri();
  const kit = __SCENARO_LOADER_CSS__;
  if (typeof kit !== 'string' || !kit.includes('@keyframes scenaro-elastic')) {
    throw new Error('Scenaro loader CSS was not inlined');
  }
  const css = kit.replace('url("./fonts/sora-latin-700.woff2")', `url("${uri}")`);
  if (css.includes('./fonts/') || css.includes('fonts.googleapis.com') || !css.includes('data:font/woff2;base64,')) {
    throw new Error('Scenaro cover font was not inlined');
  }
  return css;
}

const LOADER_CSS = inlinedLoaderCss();

const COVER_LAYOUT_CSS = `
html, body { margin: 0; height: 100%; background: #fff; }
body {
  box-sizing: border-box;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}
.scenaro-cover {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  max-width: 100%;
  color: #2e2b35;
}
.scenaro-cover .track {
  height: 2px;
  border-radius: 999px;
  background: #eceae6;
  overflow: hidden;
}
.scenaro-cover .bar {
  height: 100%;
  width: 0;
  border-radius: inherit;
  background: currentColor;
  animation: scenaro-load 2s cubic-bezier(.4, 0, .2, 1) forwards;
  animation-play-state: paused;
}
.run .bar { animation-play-state: running; }
@keyframes scenaro-load { to { width: 100%; } }
@media (prefers-reduced-motion: reduce) {
  .scenaro-cover .bar { animation: none; }
}
`;

/**
 * Elastic symbol, fixed word, status underneath, then the existing hold bar.
 * The 3s loop is not a gate: the host removes this document when the wait ends.
 */
export function coverDocument(status: string, size: CoverSize): string {
  const markup = scenaroLoaderMarkup({
    size,
    theme: 'light',
    label: status,
    id: 'scenaro-cover',
  });
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
    + LOADER_CSS
    + COVER_LAYOUT_CSS
    + '</style></head><body><div class="scenaro-cover">'
    + markup
    + '<div class="track" aria-hidden="true"><div class="bar"></div></div></div></body></html>';
}

/** Static mark for the host launcher. The elastic loop stays inside the cover iframe. */
export function launcherMarkSvg(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" width="18.3" height="16" aria-hidden="true"><path fill="${fill}" fill-rule="evenodd" d="${MARK_PATH}"/></svg>`;
}
