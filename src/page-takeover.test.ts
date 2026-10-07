/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { appearanceOf, beginPageTakeover } from './page-takeover';

describe('appearanceOf', () => {
  it('uses the page takeover unless the panel is chosen', () => {
    expect(appearanceOf(undefined)).toBe('takeover');
    expect(appearanceOf('')).toBe('takeover');
    expect(appearanceOf('takeover')).toBe('takeover');
    expect(appearanceOf('elsewhere')).toBe('takeover');
    expect(appearanceOf('panel')).toBe('panel');
    expect(appearanceOf(' panel ')).toBe('panel');
  });
});

describe('beginPageTakeover', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
  });

  it('keeps the store nodes and ignores an iframe added after the sweep starts', async () => {
    document.body.innerHTML = '<p style="opacity:1">Bouteille</p><div style="opacity:1">Carte</div>';
    const paragraph = document.querySelector('p') as HTMLElement;
    const card = document.querySelector('div') as HTMLElement;
    stubBox(paragraph);
    stubBox(card);

    const session = beginPageTakeover({ duration: 0, sweep: 0, coverMs: 0, holdMs: 0, force: true });
    const experience = document.createElement('iframe');
    experience.id = 'scenaro-iframe';
    document.documentElement.appendChild(experience);

    const play = session.play();
    expect(document.body.textContent).toContain('Bouteille');
    expect(document.getElementById('scenaro-iframe')).toBe(experience);
    await play;
    expect(experience.isConnected).toBe(true);
    expect(experience.style.transform).toBe('');

    await session.restore();
    expect(document.querySelector('[data-scenaro-wrap]')).toBeNull();
    expect(document.querySelector('[data-scenaro-cover]')).toBeNull();
    expect(document.body.style.position).toBe('');
    expect(document.body.textContent).toContain('Bouteille');
    experience.remove();
  });
});

function stubBox(el: HTMLElement): void {
  el.style.opacity = '1';
  el.getBoundingClientRect = () => ({
    width: 120,
    height: 40,
    top: 20,
    left: 16,
    right: 136,
    bottom: 60,
    x: 16,
    y: 20,
    toJSON: () => ({}),
  });
}
