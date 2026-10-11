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
    const cover = document.querySelector('[data-scenaro-cover]') as HTMLIFrameElement;
    expect(cover.srcdoc).toContain('>scenaro<');
    expect(cover.srcdoc).toContain('Chargement en cours');
    expect(cover.srcdoc).not.toContain('propuls');
    const experience = document.createElement('iframe');
    experience.id = 'scenaro-iframe';
    document.documentElement.appendChild(experience);

    const play = session.play();
    expect(document.body.style.position).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.textContent).toContain('Bouteille');
    expect(document.getElementById('scenaro-iframe')).toBe(experience);
    await play;
    expect(experience.isConnected).toBe(true);
    expect(experience.style.transform).toBe('');

    await session.restore();
    expect(document.documentElement.classList.contains('scenaro-clear-overlays')).toBe(false);
    expect(document.querySelector('[data-scenaro-overlay-clear]')).toBeNull();
    expect(document.querySelector('[data-scenaro-wrap]')).toBeNull();
    expect(document.querySelector('[data-scenaro-cover]')).toBeNull();
    expect(document.body.style.position).toBe('');
    expect(document.body.textContent).toContain('Bouteille');
    experience.remove();
  });

  it('sweeps products below the screen instead of erasing them', async () => {
    document.body.innerHTML = '<p style="opacity:1">Haut</p><p style="opacity:1">Bas</p>';
    const [high, low] = [...document.querySelectorAll('p')] as HTMLElement[];
    const calls: { el: HTMLElement; frames: Keyframe[]; timing: KeyframeAnimationOptions }[] = [];
    const animate = function (this: HTMLElement, frames: Keyframe[] | PropertyIndexedKeyframes | null, timing?: number | KeyframeAnimationOptions) {
      calls.push({ el: this, frames: frames as Keyframe[], timing: (timing ?? {}) as KeyframeAnimationOptions });
      return { cancel() {}, finished: Promise.resolve(), effect: null } as unknown as Animation;
    };
    high.animate = animate;
    low.animate = animate;
    stubBox(high, 24);
    stubBox(low, window.innerHeight + 900);

    const session = beginPageTakeover({ duration: 80, sweep: 200, coverMs: 0, holdMs: 0, force: true });
    const play = session.play();
    const lowCall = calls.find((call) => call.el === low);
    expect(lowCall).toBeTruthy();
    expect(Number(lowCall?.timing.duration)).toBeGreaterThan(0);
    expect(Number(lowCall?.timing.delay)).toBe(200);
    expect(JSON.stringify(lowCall?.frames)).toContain('translate');
    await play;
    await session.restore();
  });
});

function stubBox(el: HTMLElement, top = 20): void {
  el.style.opacity = '1';
  el.getBoundingClientRect = () => ({
    width: 120,
    height: 40,
    top,
    left: 16,
    right: 136,
    bottom: top + 40,
    x: 16,
    y: top,
    toJSON: () => ({}),
  });
}
