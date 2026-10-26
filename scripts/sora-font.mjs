import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Inlines the brand loader CSS and Sora file so the widget bundle does not fetch them. */
export function soraFontDefine() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const fontPath = join(root, 'brand/fonts/sora-latin-700.woff2');
  const cssPath = join(root, 'brand/scenaro-loader.css');
  const base64 = readFileSync(fontPath).toString('base64');
  const css = readFileSync(cssPath, 'utf8') + '\n' + readFileSync(join(root, 'brand/scenaro-arrival.css'), 'utf8');
  if (base64.length < 1000) throw new Error(`Sora font missing at ${fontPath}`);
  if (!css.includes('@keyframes scenaro-elastic')) throw new Error(`Loader CSS missing at ${cssPath}`);
  return {
    __SCENARO_SORA_WOFF2__: JSON.stringify(base64),
    __SCENARO_LOADER_CSS__: JSON.stringify(css),
  };
}
