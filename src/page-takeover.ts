/**
 * Clears the visible page, then leaves room for the experience iframe.
 * The store DOM stays in place so the cart engine can still reach it.
 * restore() puts the page back.
 */

import { coverDocument, type CoverSize } from './cover-loader';

export type AppearanceName = 'takeover' | 'panel';

export function appearanceOf(value: string | null | undefined): AppearanceName {
  return value?.trim() === 'panel' ? 'panel' : 'takeover';
}

/** Cover fade and bar length, shared by the immersive sweep and the written panel. */
export const LOADER_FADE_MS = 220;
export const LOADER_HOLD_MS = 2000;

export interface PageTakeoverOptions {
  force?: boolean;
  duration?: number;
  sweep?: number;
  coverMs?: number;
  holdMs?: number;
}

export interface PageTakeoverSession {
  play(): Promise<void>;
  fadeCoverOut(): Promise<void>;
  /** Puts the white cover back in front so the store stays hidden while the iframe leaves. */
  seal(): void;
  restore(): Promise<void>;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'HEAD', 'BR', 'WBR', 'TEMPLATE', 'SOURCE', 'TRACK']);
const ATOM = new Set(['IMG', 'SVG', 'VIDEO', 'CANVAS', 'IFRAME', 'HR', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'AUDIO', 'OBJECT', 'EMBED', 'METER', 'PROGRESS']);
const WRAP_RESET = [
  'margin:0 !important',
  'padding:0 !important',
  'border:0 !important',
  'background:none !important',
  'box-shadow:none !important',
  'text-shadow:none !important',
  'color:inherit !important',
  'font:inherit !important',
  'letter-spacing:inherit !important',
  'line-height:inherit !important',
  'text-transform:inherit !important',
  'text-decoration:inherit !important',
  'white-space:inherit !important',
].join(';');

type Paint = Record<string, string>;

interface AtomItem {
  el: HTMLElement;
  kind: 'atom';
  opacity: string;
  exit: number;
  key: number;
  top: number;
  above: boolean;
}

interface ShellItem {
  el: HTMLElement;
  kind: 'shell';
  from: Paint;
  to: Paint;
  exit: number;
  key: number;
  top: number;
  above: boolean;
}

type Item = AtomItem | ShellItem;

export function beginPageTakeover(options: PageTakeoverOptions = {}): PageTakeoverSession {
  const reduce = !options.force && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = options.duration ?? (reduce ? 180 : 640);
  const sweep = reduce ? 0 : (options.sweep ?? 1000);
  const coverMs = options.coverMs ?? LOADER_FADE_MS;
  const holdMs = options.holdMs ?? LOADER_HOLD_MS;
  const overlayMs = options.duration === 0 && options.sweep === 0 ? 0 : (reduce ? 0 : 180);

  const wrapped = wrapLooseText(document.body);
  const restoreSheet = layWhiteSheet();
  const atoms = collectAtoms(document.documentElement);
  const shells = collectShells(document.documentElement, atoms);
  const items: Item[] = [
    ...atoms.map((el): AtomItem => {
      const spot = spotOf(el);
      return {
        el,
        kind: 'atom',
        opacity: getComputedStyle(el).opacity,
        exit: reduce ? 0 : spot.exit,
        key: spot.key,
        top: spot.top,
        above: spot.above,
      };
    }),
    ...shells.map((shell): ShellItem => {
      const spot = spotOf(shell.el);
      return { ...shell, kind: 'shell', exit: 0, key: spot.key, top: spot.top, above: spot.above };
    }),
  ];
  const unlockScroll = lockScroll();
  const releasePointer = blockPointer();
  const frame = coverWithWhiteFrame();

  const anims: Animation[] = [];
  let restored = false;
  let playing: Promise<void> | null = null;
  let restoring: Promise<void> | null = null;
  let removeOverlayClear = () => {};
  let restoreClipping = () => {};
  let releaseDeparted = () => {};
  const stopCoverTrack = trackCover(frame);

  const play = (): Promise<void> => {
    if (restored) return Promise.resolve();
    if (playing) return playing;
    playing = runPlay().finally(() => {
      playing = null;
    });
    return playing;
  };

  const restore = (): Promise<void> => {
    if (restoring) return restoring;
    restored = true;
    restoring = runRestore();
    return restoring;
  };

  const fadeCoverOut = (): Promise<void> => fadeOpacity(frame, 1, 0, coverMs);

  const seal = (): void => {
    cancel(frame.getAnimations?.() ?? []);
    frame.style.setProperty('opacity', '1', 'important');
  };

  return { play, fadeCoverOut, seal, restore };

  async function runPlay(): Promise<void> {
    removeOverlayClear = clearPageOverlays(overlayMs);
    restoreClipping = openClipping(items);
    // The wave crosses the screen in a fixed time. Page length and scroll
    // position do not push the loader later.
    const parked = items.filter((item) => item.above);
    const wave = items.filter((item) => !item.above);
    const coverAt = sweep > 0 ? sweep + 160 : duration;
    for (const item of parked) playOut(item, { duration: 0, fill: 'forwards' });
    for (const item of wave) {
      playOut(item, {
        duration,
        delay: delayOnScreen(item.top, item.key % 1e7, sweep),
        easing: 'cubic-bezier(0.45, 0, 1, 1)',
        fill: 'forwards',
      });
    }
    await sleep(coverAt);
    if (restored) return;
    releasePointer();
    startCoverLoader(frame, holdMs);
    await fadeOpacity(frame, 0, 1, coverMs);
    if (restored) return;
    if (holdMs > 0) await sleep(holdMs);
    if (restored) return;
    releaseDeparted = holdDeparted(items);
  }

  async function runRestore(): Promise<void> {
    if (playing) await playing.catch(() => undefined);
    // The cover stays opaque until the page is whole again underneath it.
    // Releasing the swept elements first is what made the graphics return
    // while the experience was still open.
    cancel(frame.getAnimations?.() ?? []);
    frame.style.removeProperty('opacity');
    frame.style.opacity = '1';
    cancel(anims);
    releaseDeparted();
    removeOverlayClear();
    restoreClipping();
    await fadeOpacity(frame, 1, 0, coverMs > 0 ? 280 : 0);
    frame.remove();
    stopCoverTrack();
    restoreSheet();
    unwrap(wrapped);
    releasePointer();
    unlockScroll();
  }

  function playOut(item: Item, timing: KeyframeAnimationOptions): Animation | null {
    if (restored) return null;
    try {
      const anim = item.kind === 'atom'
        ? item.el.animate(
          item.above ? [{ opacity: item.opacity }, { opacity: '0' }] : depart(item.opacity, item.exit),
          timing,
        )
        : item.el.animate([item.from, item.to], timing);
      anims.push(anim);
      return anim;
    } catch {
      // Older browsers without the Web Animations API keep the page still.
      return null;
    }
  }
}

function opaque(color: string): boolean {
  if (!color || color === 'transparent') return false;
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return true;
  const parts = match[1].split(',').map((part) => parseFloat(part));
  return parts.length < 4 || parts[3] > 0.01;
}

function hasBox(el: Element, style?: CSSStyleDeclaration): boolean {
  style = style || getComputedStyle(el);
  if (style.display === 'none' || style.display === 'contents') return false;
  if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  if (style.contentVisibility === 'hidden') return false;
  if (style.opacity !== '' && Number(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width >= 1 && rect.height >= 1;
}

function isInline(display: string): boolean {
  return display === 'inline' || display === 'ruby' || display === 'contents';
}

function isGrouping(display: string): boolean {
  return display.includes('flex') || display.includes('grid');
}

function isTextRun(style: CSSStyleDeclaration, kids: Element[]): boolean {
  if (isGrouping(style.display)) return false;
  return kids.every((kid) => isInline(getComputedStyle(kid).display));
}

function walk(el: Element, visit: (el: Element) => void): void {
  if (SKIP.has(el.tagName)) return;
  visit(el);
  for (const child of el.children) walk(child, visit);
  if (el.shadowRoot) {
    for (const child of el.shadowRoot.children) walk(child, visit);
  }
}

function wrapLooseText(root: HTMLElement): HTMLElement[] {
  const created: HTMLElement[] = [];
  walk(root, (el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml') return;
    if (ATOM.has(el.tagName) || el.closest('svg, math')) return;
    let hasText = false;
    let hasBlock = false;
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim()) hasText = true;
      if (node.nodeType === Node.ELEMENT_NODE && hasBox(node as Element) && !isInline(getComputedStyle(node as Element).display)) {
        hasBlock = true;
      }
    }
    if (!hasText || !hasBlock) return;
    const parentDisplay = getComputedStyle(el).display;
    for (const node of [...el.childNodes]) {
      if (node.nodeType !== Node.TEXT_NODE || !(node.textContent || '').trim()) continue;
      const span = document.createElement('span');
      span.dataset.scenaroWrap = '1';
      span.style.cssText = WRAP_RESET;
      if (!isGrouping(parentDisplay)) span.style.setProperty('display', 'inline', 'important');
      node.parentNode?.insertBefore(span, node);
      span.appendChild(node);
      created.push(span);
    }
  });
  return created;
}

function unwrap(spans: HTMLElement[]): void {
  for (const span of spans) {
    const parent = span.parentNode;
    if (!parent) continue;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
  }
}

function collectAtoms(root: Element): HTMLElement[] {
  const atoms: HTMLElement[] = [];
  const seenSet = new Set<Element>();
  const add = (el: HTMLElement) => {
    if (!seenSet.has(el)) {
      seenSet.add(el);
      atoms.push(el);
    }
  };
  const collect = (el: Element) => {
    if (SKIP.has(el.tagName)) return;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.contentVisibility === 'hidden') return;
    if (el.tagName === 'SLOT') {
      for (const child of el.children) collect(child);
      return;
    }
    if (ATOM.has(el.tagName)) {
      if (el instanceof HTMLElement && hasBox(el, style)) add(el);
      return;
    }
    if (el instanceof HTMLElement && hasBox(el, style)) {
      const kids = [...el.children].filter((kid) => hasBox(kid));
      const shadowDraws = !!el.shadowRoot && [...el.shadowRoot.children].some((kid) => !SKIP.has(kid.tagName));
      if (!shadowDraws && (kids.length === 0 || isTextRun(style, kids))) {
        add(el);
        return;
      }
    }
    for (const child of el.children) collect(child);
    if (el.shadowRoot) {
      for (const child of el.shadowRoot.children) collect(child);
    }
  };
  collect(root);
  return atoms;
}

function shellPaint(style: CSSStyleDeclaration): { from: Paint; to: Paint } | null {
  const from: Paint = {};
  const to: Paint = {};
  const hasImage = !!style.backgroundImage && style.backgroundImage !== 'none';
  if (opaque(style.backgroundColor) || hasImage) {
    from.backgroundColor = style.backgroundColor;
    to.backgroundColor = 'transparent';
  }
  if (hasImage) {
    from.backgroundImage = style.backgroundImage;
    to.backgroundImage = 'none';
  }
  const borderWidth = parseFloat(style.borderTopWidth) + parseFloat(style.borderRightWidth)
    + parseFloat(style.borderBottomWidth) + parseFloat(style.borderLeftWidth);
  if (borderWidth > 0 && opaque(style.borderTopColor)) {
    from.borderColor = style.borderColor;
    to.borderColor = 'transparent';
  }
  if (style.boxShadow && style.boxShadow !== 'none') {
    from.boxShadow = style.boxShadow;
    to.boxShadow = 'none';
  }
  if (style.backdropFilter && style.backdropFilter !== 'none') {
    from.backdropFilter = style.backdropFilter;
    to.backdropFilter = 'none';
  }
  return Object.keys(from).length ? { from, to } : null;
}

function clearPageOverlays(ms: number): () => void {
  const style = document.createElement('style');
  style.dataset.scenaroOverlayClear = '1';
  style.textContent = [
    `html.scenaro-clear-overlays{--scenaro-overlay-ms:${ms}ms;}`,
    'html.scenaro-clear-overlays *::before,',
    'html.scenaro-clear-overlays *::after{',
    'opacity:0 !important;',
    'background:none !important;',
    'background-image:none !important;',
    'box-shadow:none !important;',
    'backdrop-filter:none !important;',
    '-webkit-backdrop-filter:none !important;',
    'transition:opacity var(--scenaro-overlay-ms) ease !important;',
    '}',
    'html.scenaro-clear-overlays [data-scenaro-chrome]::before,',
    'html.scenaro-clear-overlays [data-scenaro-chrome]::after,',
    'html.scenaro-clear-overlays [data-scenaro-chrome] *::before,',
    'html.scenaro-clear-overlays [data-scenaro-chrome] *::after{',
    'opacity:revert !important;background:revert !important;box-shadow:revert !important;transition:none !important;',
    '}',
  ].join('');
  document.documentElement.classList.add('scenaro-clear-overlays');
  document.documentElement.appendChild(style);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    document.documentElement.classList.remove('scenaro-clear-overlays');
    style.remove();
  };
}

function collectShells(root: Element, atoms: HTMLElement[]): ShellItem[] {
  const atomSet = new Set<Element>(atoms);
  const shells: ShellItem[] = [];
  const collect = (el: Element, insideAtom: boolean) => {
    if (SKIP.has(el.tagName)) return;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.contentVisibility === 'hidden') return;
    const isAtom = atomSet.has(el);
    const isCanvas = el === document.documentElement || el === document.body;
    if (!insideAtom && !isAtom && !isCanvas && el instanceof HTMLElement && hasBox(el, style)) {
      const paint = shellPaint(style);
      if (paint) shells.push({ el, kind: 'shell', exit: 0, key: 0, top: 0, above: false, ...paint });
    }
    if (isAtom || ATOM.has(el.tagName)) return;
    for (const child of el.children) collect(child, insideAtom);
    if (el.shadowRoot) {
      for (const child of el.shadowRoot.children) collect(child, insideAtom);
    }
  };
  collect(root, false);
  return shells;
}

function openClipping(items: Item[]): () => void {
  const saved: { el: HTMLElement; value: string; priority: string }[] = [];
  const opened = new Set<HTMLElement>();
  const width = window.innerWidth;
  const height = window.innerHeight;
  for (const item of items) {
    if (item.above) continue;
    let parent = item.el.parentElement;
    while (parent && parent !== document.body && parent !== document.documentElement) {
      if (!opened.has(parent)) {
        const style = getComputedStyle(parent);
        const clips = style.overflowX === 'hidden' || style.overflowX === 'clip'
          || style.overflowX === 'auto' || style.overflowX === 'scroll';
        if (clips) {
          const rect = parent.getBoundingClientRect();
          const coversViewport = rect.width >= width - 2 && rect.height >= height - 2;
          if (!coversViewport || rect.height > height + 40) {
            opened.add(parent);
            saved.push({
              el: parent,
              value: parent.style.getPropertyValue('overflow'),
              priority: parent.style.getPropertyPriority('overflow'),
            });
            parent.style.setProperty('overflow', 'visible', 'important');
          }
        }
      }
      parent = parent.parentElement;
    }
  }
  return () => {
    for (const item of saved) {
      if (item.value) item.el.style.setProperty('overflow', item.value, item.priority);
      else item.el.style.removeProperty('overflow');
    }
  };
}

function spotOf(el: Element): { above: boolean; key: number; top: number; exit: number } {
  const rect = el.getBoundingClientRect();
  const width = window.innerWidth;
  const row = Math.floor(Math.max(rect.top, 0) / 34);
  return {
    above: rect.bottom <= 0,
    key: row * 1e7 + Math.max(rect.left, 0),
    top: rect.top,
    exit: Math.max(72, width - rect.left + 36),
  };
}

function delayOnScreen(top: number, left: number, sweep: number): number {
  if (sweep <= 0) return 0;
  const height = Math.max(window.innerHeight, 1);
  const width = Math.max(window.innerWidth, 1);
  const y = Math.min(Math.max(top, 0), height) / height;
  const x = Math.min(Math.max(left, 0), width) / width;
  return Math.min(sweep, y * sweep + x * Math.min(48, sweep * 0.08));
}

function depart(opacity: string, exit: number): Keyframe[] {
  return [
    { opacity, translate: '0px 0px', offset: 0 },
    { opacity, translate: `${exit * 0.28}px 0px`, offset: 0.42 },
    { opacity: '0', translate: `${exit}px 0px`, offset: 1 },
  ];
}

function animationEnd(anim: Animation): number {
  const effect = anim.effect;
  if (!effect || !('getComputedTiming' in effect)) return 0;
  try {
    const timing = effect.getComputedTiming();
    const delay = Number(timing.delay) || 0;
    const active = timing.activeDuration != null ? timing.activeDuration : timing.duration;
    const durationMs = Number(active) || 0;
    const endDelay = Number(timing.endDelay) || 0;
    return Math.max(0, delay + durationMs + endDelay);
  } catch {
    return 0;
  }
}

function whenDone(anims: Animation[], fallbackMs: number): Promise<void> {
  let end = 0;
  for (const anim of anims) end = Math.max(end, animationEnd(anim));
  end = Math.max(end, fallbackMs || 0);
  return new Promise((resolve) => {
    window.setTimeout(resolve, end + 80);
  });
}

function fadeOpacity(el: HTMLElement, from: number, to: number, ms: number): Promise<void> {
  try {
    return whenDone([el.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: 'ease', fill: 'forwards' })], ms);
  } catch {
    el.style.opacity = String(to);
    return Promise.resolve();
  }
}

export interface ViewportBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The rectangle Chrome is actually showing. The layout viewport is taller while the URL bar is out. */
export function visibleViewportBox(win: Window = window): ViewportBox {
  const viewport = win.visualViewport;
  return {
    top: viewport?.offsetTop ?? 0,
    left: viewport?.offsetLeft ?? 0,
    width: Math.round(viewport?.width ?? win.innerWidth),
    height: Math.round(viewport?.height ?? win.innerHeight),
  };
}

/** Pins an element to the visible viewport. Theme CSS must not be able to stretch it with 100vh. */
export function placeFixedBox(el: HTMLElement, box: ViewportBox = visibleViewportBox()): void {
  el.style.setProperty('position', 'fixed', 'important');
  el.style.setProperty('top', `${box.top}px`, 'important');
  el.style.setProperty('left', `${box.left}px`, 'important');
  el.style.setProperty('width', `${box.width}px`, 'important');
  el.style.setProperty('height', `${box.height}px`, 'important');
  el.style.setProperty('right', 'auto', 'important');
  el.style.setProperty('bottom', 'auto', 'important');
  el.style.setProperty('max-width', 'none', 'important');
  el.style.setProperty('margin', '0', 'important');
}

function trackCover(frame: HTMLIFrameElement): () => void {
  const place = () => placeFixedBox(frame);
  place();
  window.addEventListener('resize', place);
  window.addEventListener('orientationchange', place);
  const viewport = window.visualViewport;
  viewport?.addEventListener('resize', place);
  viewport?.addEventListener('scroll', place);
  return () => {
    window.removeEventListener('resize', place);
    window.removeEventListener('orientationchange', place);
    viewport?.removeEventListener('resize', place);
    viewport?.removeEventListener('scroll', place);
  };
}

/** Writes the swept-away state onto the elements so a finished animation cannot bring them back. */
function holdDeparted(items: Item[]): () => void {
  const saved = items.map((item) => ({
    el: item.el,
    opacity: item.el.style.getPropertyValue('opacity'),
    opacityPriority: item.el.style.getPropertyPriority('opacity'),
    visibility: item.el.style.getPropertyValue('visibility'),
    visibilityPriority: item.el.style.getPropertyPriority('visibility'),
  }));
  for (const item of saved) {
    item.el.style.setProperty('opacity', '0', 'important');
    item.el.style.setProperty('visibility', 'hidden', 'important');
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const item of saved) {
      if (item.opacity) item.el.style.setProperty('opacity', item.opacity, item.opacityPriority);
      else item.el.style.removeProperty('opacity');
      if (item.visibility) item.el.style.setProperty('visibility', item.visibility, item.visibilityPriority);
      else item.el.style.removeProperty('visibility');
    }
  };
}

/** Keeps the store from sliding out from under the open iframe. Android Chrome ignores overflow:hidden alone. */
export function pinHostPage(): () => void {
  const html = document.documentElement;
  const body = document.body;
  const scrollY = window.scrollY || html.scrollTop || body.scrollTop || 0;
  const saved: { el: HTMLElement; prop: string; value: string; priority: string }[] = [];
  const remember = (el: HTMLElement, prop: string) => {
    saved.push({
      el,
      prop,
      value: el.style.getPropertyValue(prop),
      priority: el.style.getPropertyPriority(prop),
    });
  };
  for (const el of [html, body]) {
    for (const prop of ['overflow', 'overscroll-behavior']) remember(el, prop);
    el.style.setProperty('overflow', 'hidden', 'important');
    el.style.setProperty('overscroll-behavior', 'none', 'important');
  }
  for (const prop of ['position', 'top', 'left', 'right', 'width']) remember(body, prop);
  body.style.setProperty('position', 'fixed', 'important');
  body.style.setProperty('top', `-${scrollY}px`, 'important');
  body.style.setProperty('left', '0', 'important');
  body.style.setProperty('right', '0', 'important');
  body.style.setProperty('width', '100%', 'important');
  const stop = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  const snap = () => {
    if (window.scrollY !== scrollY) window.scrollTo(0, scrollY);
  };
  window.addEventListener('touchmove', stop, { passive: false, capture: true });
  window.addEventListener('wheel', stop, { passive: false, capture: true });
  window.addEventListener('scroll', snap);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    window.removeEventListener('touchmove', stop, { capture: true });
    window.removeEventListener('wheel', stop, { capture: true });
    window.removeEventListener('scroll', snap);
    for (const item of saved) {
      if (item.value) item.el.style.setProperty(item.prop, item.value, item.priority);
      else item.el.style.removeProperty(item.prop);
    }
    window.scrollTo(0, scrollY);
  };
}

function lockScroll(): () => void {
  // Block the gesture only. Pinning the body with position:fixed and
  // overflow:hidden clips Magento to one screen, so the lower products vanish.
  const stopPointer = (event: Event) => event.preventDefault();
  const stopKeys = (event: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
      event.preventDefault();
    }
  };
  window.addEventListener('wheel', stopPointer, { passive: false, capture: true });
  window.addEventListener('touchmove', stopPointer, { passive: false, capture: true });
  window.addEventListener('keydown', stopKeys, { capture: true });
  return () => {
    window.removeEventListener('wheel', stopPointer, { capture: true });
    window.removeEventListener('touchmove', stopPointer, { capture: true });
    window.removeEventListener('keydown', stopKeys, { capture: true });
  };
}

function layWhiteSheet(): () => void {
  const saved: { el: HTMLElement; background: string; backgroundColor: string; backgroundImage: string }[] = [];
  for (const el of [document.documentElement, document.body]) {
    saved.push({
      el,
      background: el.style.background,
      backgroundColor: el.style.backgroundColor,
      backgroundImage: el.style.backgroundImage,
    });
    el.style.setProperty('background-color', '#ffffff', 'important');
    el.style.setProperty('background-image', 'none', 'important');
  }
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const item of saved) {
      item.el.style.removeProperty('background-color');
      item.el.style.removeProperty('background-image');
      if (item.background) item.el.style.background = item.background;
      if (item.backgroundColor) item.el.style.backgroundColor = item.backgroundColor;
      if (item.backgroundImage) item.el.style.backgroundImage = item.backgroundImage;
    }
  };
}

function blockPointer(): () => void {
  const style = document.createElement('style');
  style.dataset.scenaroPointer = '1';
  style.textContent = 'html, html * { pointer-events: none !important; cursor: default !important; } [data-scenaro-chrome], [data-scenaro-chrome] * { pointer-events: auto !important; cursor: pointer !important; }';
  document.documentElement.appendChild(style);
  const stop = (event: Event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('[data-scenaro-chrome]')) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const types = ['pointerdown', 'pointerup', 'pointermove', 'pointerover', 'pointerenter', 'pointerleave', 'pointerout', 'pointercancel', 'mouseover', 'mouseenter', 'mouseleave', 'mouseout', 'mousemove', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'dragstart'];
  for (const type of types) window.addEventListener(type, stop, { capture: true, passive: false });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const type of types) window.removeEventListener(type, stop, { capture: true });
    style.remove();
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const LOADER_STATUS = 'Chargement en cours';
/** Full-screen cover: the hold bar is the progress. No status sentence. */
export const IMMERSIVE_LOADER_STATUS = '';

/** White cover that fills its parent. The immersive sweep pins it to the viewport. */
export function createLoaderFrame(
  pin: 'viewport' | 'parent' = 'parent',
  status = LOADER_STATUS,
  size: CoverSize = pin === 'viewport' ? 'large' : 'standard',
): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.dataset.scenaroCover = '1';
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.srcdoc = coverDocument(status, size);
  frame.style.cssText = pin === 'viewport'
    ? 'position:fixed;inset:0;width:100vw;height:100vh;border:0;margin:0;padding:0;background:#fff;z-index:2147483646;opacity:0;cursor:default;'
    : 'position:absolute;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;background:#fff;z-index:1;opacity:0;';
  frame.style.setProperty('pointer-events', 'none', 'important');
  return frame;
}

/** Fade the cover in and run the bar for holdMs, the same clock as the immersive loader. */
export function playLoader(frame: HTMLIFrameElement, holdMs = LOADER_HOLD_MS, fadeMs = LOADER_FADE_MS, shown = false): Promise<void> {
  startCoverLoader(frame, holdMs);
  if (shown) revealCover(frame);
  return fadeOpacity(frame, 0, 1, fadeMs).then(() => sleep(holdMs));
}

/** Start the mark next to the word when the cover is shown, not while the iframe was hidden. */
function restartSpring(root: ParentNode): void {
  const spring = root.querySelector('.scenaro-mark__spring');
  if (!(spring instanceof HTMLElement)) return;
  spring.style.animation = 'none';
  void spring.offsetWidth;
  spring.style.animation = '';
}

/** The panel iframe does not always paint on the slide, so the lockup is shown directly. The spring keeps scenaro-elastic. */
function revealCover(frame: HTMLIFrameElement): void {
  const started = performance.now();
  const show = () => {
    const loader = frame.contentDocument?.querySelector('.scenaro-loader');
    if (!(loader instanceof HTMLElement)) return false;
    loader.style.opacity = '1';
    const body = frame.contentDocument?.body;
    if (body) {
      body.classList.remove('run');
      void body.offsetWidth;
      body.classList.add('run');
      restartSpring(body);
    }
    return true;
  };
  const tick = () => {
    if (show() || performance.now() - started > 1000) return;
    window.setTimeout(tick, 30);
  };
  tick();
}

export function fadeLoader(frame: HTMLIFrameElement, fadeMs = LOADER_FADE_MS): Promise<void> {
  return fadeOpacity(frame, 1, 0, fadeMs);
}

function startCoverLoader(frame: HTMLIFrameElement, ms: number): void {
  const arm = () => {
    const body = frame.contentDocument?.body;
    if (!body) return;
    const bar = body.querySelector('.bar');
    if (bar && bar.nodeType === 1 && 'style' in bar && ms > 0) {
      (bar as HTMLElement).style.animationDuration = `${ms}ms`;
    }
    body.classList.add('run');
    restartSpring(body);
  };
  if (frame.contentDocument?.body) arm();
  else frame.addEventListener('load', arm, { once: true });
}

function coverWithWhiteFrame(): HTMLIFrameElement {
  const frame = createLoaderFrame('viewport', IMMERSIVE_LOADER_STATUS);
  document.documentElement.appendChild(frame);
  return frame;
}

function cancel(anims: Animation[]): void {
  for (const anim of anims) {
    try {
      anim.cancel();
    } catch {
      // Already finished.
    }
  }
}
