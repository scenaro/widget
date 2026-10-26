/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { LOADER_VIEWBOX, MARK_PATH, VIEWBOX, WORDMARK_STEM } from '../brand/geometry.js';
import { coverDocument, launcherMarkSvg } from './cover-loader';
import { ScenaroWidget } from './widget';

/** base64 of brand/fonts/sora-latin-700.woff2, so the cover cannot swap in another file. */
const SORA_WOFF2_PREFIX = 'd09GMgABAAAAADsYABAAAAAAfgAAADq2AAEAAAAAAAAAAAAA';
const SORA_WOFF2_BASE64_LENGTH = 20172;

function cover(status: string, size: 'standard' | 'large' = 'large') {
  const html = coverDocument(status, size);
  return { html, doc: new DOMParser().parseFromString(html, 'text/html') };
}

describe('coverDocument', () => {
  it('plays the Commerce passage once with the ring as the final o and an offline font', () => {
    const { html, doc } = cover('Expérience en chargement', 'large');
    const mover = doc.querySelector('.scenaro-arrival-mover');
    const word = doc.querySelector('.scenaro-loader__word');
    const row = doc.querySelector('.scenaro-loader__row');
    const css = doc.querySelector('style')?.textContent ?? '';

    expect(doc.querySelector('.scenaro-loader')?.className).toContain('scenaro-loader--large');
    expect(doc.querySelector('.scenaro-loader')?.className).toContain('scenaro-loader--light');
    expect(mover?.querySelector('svg')?.getAttribute('viewBox')).toBe(VIEWBOX);
    expect(mover?.querySelector('path')?.getAttribute('d')).toBe(MARK_PATH);
    expect(doc.querySelector('.scenaro-arrival')?.getAttribute('data-arrival')).toBe('passage');
    expect(doc.querySelectorAll('.scenaro-arrival-word > span')).toHaveLength(6);
    expect(word?.textContent).toBe(WORDMARK_STEM);
    expect(word?.closest('.scenaro-arrival-mover')).toBeNull();
    expect(row?.contains(mover ?? null)).toBe(true);
    expect(row?.contains(word)).toBe(true);
    expect(doc.querySelector('.scenaro-loader__label')?.textContent).toBe('Expérience en chargement');
    expect(doc.querySelector('.bar')).not.toBeNull();
    expect(css).toContain('@keyframes scenaro-elastic');
    expect(css).toContain('animation: scenaro-arrival-balle 4.2s linear 1 both');
    expect(css).toContain('scenaro-arrival-pass-s');
    expect(css).toContain('body:not(.run) .scenaro-arrival-mover');
    expect(css).toContain('transform-origin: 80px 125px');
    expect(css).toContain('transform-box: view-box');
    expect(css).toContain('letter-spacing: -0.04em');
    expect(css).toContain('font-weight: 700');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('animation: none');
    expect(doc.querySelector('.scenaro-mark__spring')).toBeNull();
    const font = html.match(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/);
    expect(font?.[1].startsWith(SORA_WOFF2_PREFIX)).toBe(true);
    expect(font?.[1].length).toBe(SORA_WOFF2_BASE64_LENGTH);
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('sora-latin-700.woff2');
    expect(html).not.toContain('M128 32a96');
    expect(html).not.toContain('32 32 192 192');
  });

  it('uses the panel size without letting the status replace the word', () => {
    const { html, doc } = cover('A & B <ok>', 'standard');
    expect(doc.querySelector('.scenaro-loader')?.className).toContain('scenaro-loader--standard');
    expect(doc.querySelector('.scenaro-loader__word')?.textContent).toBe(WORDMARK_STEM);
    expect(doc.querySelector('.scenaro-loader__label')?.textContent).toBe('A & B <ok>');
    expect(html).toContain('A &amp; B &lt;ok&gt;');
  });
});

describe('launcherMarkSvg', () => {
  it('draws the static mark and leaves the elastic loop off the host page', () => {
    const mark = launcherMarkSvg('#1a1820');
    expect(mark).toContain(`viewBox="${VIEWBOX}"`);
    expect(mark).toContain(MARK_PATH);
    expect(mark).toContain('fill="#1a1820"');
    expect(mark).not.toContain(LOADER_VIEWBOX);
    expect(mark).not.toContain('scenaro-elastic');
    expect(mark).not.toContain('scenaro-mark__spring');
    expect(mark).not.toContain('M128 32a96');
  });
});

describe('floating launcher', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the asymmetric mark beside the launcher label', () => {
    document.body.innerHTML = '<script data-publication-id="pub-1" data-entries="floating" data-floating-label="Conseiller"></script>';
    new ScenaroWidget();
    const mark = document.querySelector('.scenaro-launcher-mark svg');
    expect(mark?.getAttribute('viewBox')).toBe(VIEWBOX);
    expect(mark?.querySelector('path')?.getAttribute('d')).toBe(MARK_PATH);
    expect(mark?.querySelector('path')?.getAttribute('fill')).toBe('#1a1820');
    expect(document.querySelector('.scenaro-launcher-mark')?.innerHTML).not.toContain('scenaro-elastic');
    expect(document.querySelector('.scenaro-glass-launcher')?.textContent).toContain('Conseiller');
  });
});
