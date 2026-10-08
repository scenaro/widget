/**
 * Clears the visible page, then leaves room for the experience iframe.
 * The store DOM stays in place so the cart engine can still reach it.
 * restore() puts the page back.
 */

export type AppearanceName = 'takeover' | 'panel';

export function appearanceOf(value: string | null | undefined): AppearanceName {
  return value?.trim() === 'panel' ? 'panel' : 'takeover';
}

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
  above: boolean;
}

interface ShellItem {
  el: HTMLElement;
  kind: 'shell';
  from: Paint;
  to: Paint;
  exit: number;
  key: number;
  above: boolean;
}

type Item = AtomItem | ShellItem;

export function beginPageTakeover(options: PageTakeoverOptions = {}): PageTakeoverSession {
  const reduce = !options.force && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = options.duration ?? (reduce ? 180 : 640);
  const sweep = reduce ? 0 : (options.sweep ?? 1500);
  const coverMs = options.coverMs ?? 220;
  const holdMs = options.holdMs ?? 2000;
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
        above: spot.above,
      };
    }),
    ...shells.map((shell): ShellItem => {
      const spot = spotOf(shell.el);
      return { ...shell, kind: 'shell', exit: 0, key: spot.key, above: spot.above };
    }),
  ];
  const unlockScroll = lockScroll();
  const releasePointer = blockPointer();
  const frame = coverWithWhiteFrame();

  const anims: Animation[] = [];
  let restored = false;
  let coverShown = false;
  let playing: Promise<void> | null = null;
  let restoring: Promise<void> | null = null;
  let removeOverlayClear = () => {};
  let restoreClipping = () => {};

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
    cancel(anims);
    restoring = runRestore();
    return restoring;
  };

  const fadeCoverOut = (): Promise<void> => {
    coverShown = false;
    return fadeOpacity(frame, 1, 0, coverMs);
  };

  return { play, fadeCoverOut, restore };

  async function runPlay(): Promise<void> {
    removeOverlayClear = clearPageOverlays(overlayMs);
    restoreClipping = openClipping(items);
    // Only content already above the viewport is parked. Everything from the
    // top of the screen to the bottom of the document stays in the wave.
    const parked = items.filter((item) => item.above);
    const wave = items.filter((item) => !item.above).sort((a, b) => a.key - b.key || (a.kind === 'shell' ? -1 : 1));
    const lastVisibleRow = Math.floor(Math.max(window.innerHeight - 1, 0) / 34);
    const onScreenCount = wave.filter((item) => Math.floor(item.key / 1e7) <= lastVisibleRow).length;
    const belowCount = wave.length - onScreenCount;
    const gap = onScreenCount > 1 ? sweep / (onScreenCount - 1) : 0;
    const extraGap = belowCount > 0 ? Math.min(gap > 0 ? gap : 24, 1800 / belowCount) : 0;
    let endAt = 0;
    for (const item of parked) playOut(item, { duration: 0, fill: 'forwards' });
    wave.forEach((item, index) => {
      const below = index >= onScreenCount;
      const delay = below ? sweep + (index - onScreenCount + 1) * extraGap : index * gap;
      endAt = Math.max(endAt, delay + duration);
      playOut(item, {
        duration,
        delay,
        easing: 'cubic-bezier(0.45, 0, 1, 1)',
        fill: 'forwards',
      });
    });
    await whenDone(anims, endAt);
    if (restored) return;
    coverShown = true;
    releasePointer();
    startCoverLoader(frame, holdMs);
    await fadeOpacity(frame, 0, 1, coverMs);
    if (restored) return;
    if (holdMs > 0) await sleep(holdMs);
  }

  async function runRestore(): Promise<void> {
    if (playing) await playing.catch(() => undefined);
    cancel(anims);
    if (coverShown) await fadeOpacity(frame, 1, 0, coverMs > 0 ? 280 : 0);
    frame.remove();
    removeOverlayClear();
    restoreClipping();
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
      if (paint) shells.push({ el, kind: 'shell', exit: 0, key: 0, above: false, ...paint });
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

function spotOf(el: Element): { above: boolean; key: number; exit: number } {
  const rect = el.getBoundingClientRect();
  const width = window.innerWidth;
  // Keep the real top, including values past the bottom of the screen.
  // Clamping that edge is what made the lower products vanish instead of leaving.
  const row = Math.floor(Math.max(rect.top, 0) / 34);
  return {
    above: rect.bottom <= 0,
    key: row * 1e7 + Math.max(rect.left, 0),
    exit: Math.max(72, width - rect.left + 36),
  };
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

function lockScroll(): () => void {
  const html = document.documentElement;
  const body = document.body;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const gap = Math.max(0, window.innerWidth - html.clientWidth);
  const saved = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyPaddingRight: body.style.paddingRight,
  };
  const stopPointer = (event: Event) => event.preventDefault();
  const stopKeys = (event: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) {
      event.preventDefault();
    }
  };
  window.addEventListener('wheel', stopPointer, { passive: false, capture: true });
  window.addEventListener('touchmove', stopPointer, { passive: false, capture: true });
  window.addEventListener('keydown', stopKeys, { capture: true });
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = `-${scrollX}px`;
  body.style.right = '0';
  body.style.width = '100%';
  if (gap) body.style.paddingRight = `${gap}px`;
  return () => {
    window.removeEventListener('wheel', stopPointer, { capture: true });
    window.removeEventListener('touchmove', stopPointer, { capture: true });
    window.removeEventListener('keydown', stopKeys, { capture: true });
    html.style.overflow = saved.htmlOverflow;
    body.style.overflow = saved.bodyOverflow;
    body.style.position = saved.bodyPosition;
    body.style.top = saved.bodyTop;
    body.style.left = saved.bodyLeft;
    body.style.right = saved.bodyRight;
    body.style.width = saved.bodyWidth;
    body.style.paddingRight = saved.bodyPaddingRight;
    window.scrollTo(scrollX, scrollY);
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

function coverDocument(): string {
  return `<!DOCTYPE html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@800&display=swap"><style>
    html,body{margin:0;height:100%;background:#fff;color:#1a1820;}
    body{box-sizing:border-box;min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:32px;font-family:Sora,Inter,system-ui,sans-serif;}
    .brand{display:flex;align-items:center;justify-content:center;gap:.2em;font-size:32px;font-weight:800;letter-spacing:-.04em;line-height:1;opacity:0;transform:translateY(12px);}
    .brand svg{width:.92em;height:.92em;display:block;flex:none;transform:translateY(.04em);}
    .brand span{line-height:1;}
    .status{display:flex;flex-direction:column;align-items:center;gap:14px;opacity:0;transform:translateY(12px);}
    .status p{margin:0;font-size:13px;letter-spacing:.04em;color:#8a847c;}
    .track{width:148px;height:2px;border-radius:999px;background:#eceae6;overflow:hidden;}
    .bar{height:100%;width:0;border-radius:inherit;background:#1a1820;animation:scenaro-load 2s cubic-bezier(.4,0,.2,1) forwards;animation-play-state:paused;}
    .run .brand{animation:scenaro-in .72s cubic-bezier(.22,1,.36,1) forwards;}
    .run .status{animation:scenaro-in .72s cubic-bezier(.22,1,.36,1) .2s forwards;}
    .run .bar{animation-play-state:running;}
    @keyframes scenaro-in{to{opacity:1;transform:none;}}
    @keyframes scenaro-load{to{width:100%;}}
  </style></head><body>
    <div class="brand">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="32 32 192 192" fill="none" aria-hidden="true">
        <defs><linearGradient id="ring" x1="224" y1="128" x2="32" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#1a1820" stop-opacity="0.05"/>
          <stop offset="1" stop-color="#1a1820" stop-opacity="1"/>
        </linearGradient></defs>
        <path fill="url(#ring)" fill-rule="evenodd" d="M128 32a96 96 0 1 1 0 192 96 96 0 0 1 0-192Zm0 32a64 64 0 1 0 0 128 64 64 0 0 0 0-128Z"/>
      </svg>
      <span>scenaro</span>
    </div>
    <div class="status">
      <p>Chargement en cours</p>
      <div class="track"><div class="bar"></div></div>
    </div>
  </body></html>`;
}

function startCoverLoader(frame: HTMLIFrameElement, ms: number): void {
  const arm = () => {
    const body = frame.contentDocument?.body;
    if (!body) return;
    const bar = body.querySelector('.bar');
    if (bar instanceof HTMLElement && ms > 0) bar.style.animationDuration = `${ms}ms`;
    body.classList.add('run');
  };
  if (frame.contentDocument?.body) arm();
  else frame.addEventListener('load', arm, { once: true });
}

function coverWithWhiteFrame(): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.dataset.scenaroCover = '1';
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.srcdoc = coverDocument();
  frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;margin:0;padding:0;background:#fff;z-index:2147483646;opacity:0;cursor:default;';
  frame.style.setProperty('pointer-events', 'none', 'important');
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
