export interface AssistantCopy {
  name: string;
  role: string;
  chatLabel: string;
  immersiveLabel: string;
  waiting: string;
}

export function assistantCopy(
  dataset: { assistantName?: string; assistantRole?: string; chatLabel?: string; immersiveLabel?: string },
  floatingLabel: string,
): AssistantCopy {
  return {
    name: text(dataset.assistantName, text(floatingLabel, 'Conseiller')),
    role: text(dataset.assistantRole, 'Disponible'),
    chatLabel: text(dataset.chatLabel, 'Par écrit'),
    immersiveLabel: text(dataset.immersiveLabel, 'En immersion'),
    waiting: 'Le chat écrit arrive bientôt.',
  };
}

export function isWideChooser(): boolean {
  return window.matchMedia('(min-width: 1025px)').matches;
}

export function motionMs(full: number): number {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  return full;
}

function text(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? '';
  return trimmed !== '' ? trimmed : fallback;
}

let stylesReady = false;

export function ensureChooserStyles(): void {
  if (stylesReady || document.getElementById('scenaro-chooser-style')) {
    stylesReady = true;
    return;
  }
  if (!document.getElementById('scenaro-sora')) {
    const font = document.createElement('link');
    font.id = 'scenaro-sora';
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@500;600&display=swap';
    document.head.appendChild(font);
  }
  const style = document.createElement('style');
  style.id = 'scenaro-chooser-style';
  style.textContent = `
@keyframes scenaro-available {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.7); opacity: 0.4; }
}
.scenaro-glass-launcher,
.scenaro-glass-card,
.scenaro-glass-panel {
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}
.scenaro-glass-launcher {
  background: #fff;
  color: #1a1820;
  border-color: #eceae6;
  box-shadow: 0 8px 24px rgba(26, 24, 32, 0.08);
}
.scenaro-launcher-mark,
.scenaro-glass-mark {
  background: transparent;
  color: #1a1820;
}
.scenaro-glass-card {
  background: #fff;
  border: 1px solid #eceae6;
  color: #1a1820;
  box-shadow: 0 8px 24px rgba(26, 24, 32, 0.08);
}
.scenaro-glass-choice {
  background: transparent;
  color: #1a1820;
  border-color: transparent;
}
.scenaro-glass-choice:hover {
  background: #f4f0eb;
}
.scenaro-dock .scenaro-glass-choice {
  opacity: 0;
  transform: translateY(6px);
  transition: opacity .18s ease, transform .18s ease, background .18s ease;
}
.scenaro-dock.is-open .scenaro-glass-choice {
  opacity: 1;
  transform: none;
  transition: opacity .48s cubic-bezier(.22,1,.36,1) .08s, transform .48s cubic-bezier(.22,1,.36,1) .08s, background .18s ease;
}
.scenaro-dock.is-open .scenaro-glass-choice:nth-child(3) {
  transition-delay: .16s, .16s, 0s;
}
.scenaro-glass-panel {
  background: #fff;
  border-left: 1px solid #eceae6;
  box-shadow: -12px 0 32px rgba(26, 24, 32, 0.06);
}
.scenaro-dock {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2147483640;
  display: flex;
  flex-direction: column;
  width: var(--scenaro-closed, max-content);
  max-width: min(380px, calc(100vw - 32px));
  border-radius: 999px;
  background: #fff;
  color: #1a1820;
  border: 1px solid #eceae6;
  box-shadow: 0 8px 24px rgba(26, 24, 32, 0.08);
  overflow: hidden;
  font-family: Sora, Inter, system-ui, sans-serif;
  letter-spacing: -.03em;
  transition: width .48s cubic-bezier(.22,1,.36,1), border-radius .48s cubic-bezier(.22,1,.36,1);
}
.scenaro-dock.is-open {
  width: min(380px, calc(100vw - 32px));
  border-radius: 16px;
}
.scenaro-dock .scenaro-glass-launcher {
  width: max-content;
  max-width: none;
  white-space: nowrap;
  flex-shrink: 0;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  border-radius: 0;
  color: inherit;
}
.scenaro-dock.is-black {
  background: #1a1820;
  color: #fff;
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
}
.scenaro-dock.is-black .scenaro-glass-choice {
  color: #fff;
}
.scenaro-dock.is-black .scenaro-glass-choice:hover {
  background: rgba(255, 255, 255, 0.08);
}
.scenaro-dock.is-black .scenaro-choice-icon {
  color: #fff;
}
.scenaro-dock.is-black .scenaro-dock-track {
  background: rgba(255, 255, 255, 0.18);
}
.scenaro-dock.is-black .scenaro-dock-bar {
  background: #fff;
}
.scenaro-dock.is-open .scenaro-glass-launcher {
  width: 100%;
}
.scenaro-dock-choices {
  display: grid;
  grid-template-rows: 0fr;
  visibility: hidden;
  transition: grid-template-rows .48s cubic-bezier(.22,1,.36,1);
}
.scenaro-dock.is-open .scenaro-dock-choices {
  grid-template-rows: 1fr;
  visibility: visible;
}
.scenaro-dock-chevron {
  display: inline-flex;
  margin-left: 2px;
  transition: transform .48s cubic-bezier(.22,1,.36,1);
}
.scenaro-dock.is-open .scenaro-dock-chevron {
  margin-left: auto;
  transform: rotate(180deg);
}
.scenaro-dock-track {
  height: 2px;
  width: 112px;
  margin: 2px auto 12px;
  border-radius: 999px;
  background: #eceae6;
  overflow: hidden;
}
.scenaro-dock-bar {
  height: 100%;
  width: 0;
  border-radius: inherit;
  background: #1a1820;
  transition: width .18s ease;
}
.scenaro-dock.is-open .scenaro-dock-bar {
  width: 100%;
  transition: width .72s cubic-bezier(.4,0,.2,1);
}
.scenaro-choice-icon {
  display: inline-flex;
  flex: 0 0 auto;
  color: #1a1820;
}
.scenaro-dock-choices-inner {
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 4px;
}
.scenaro-dock.is-open .scenaro-dock-choices-inner {
  padding-bottom: 12px;
}
@media (prefers-reduced-motion: reduce) {
  [data-scenaro-available] { animation: none !important; }
  .scenaro-dock,
  .scenaro-dock-choices,
  .scenaro-dock .scenaro-glass-choice,
  .scenaro-dock-bar {
    transition: none !important;
  }
}
`;
  document.head.appendChild(style);
  stylesReady = true;
}

/** Choices that unfold inside the launcher, not in a separate menu. */
export function buildDockChoices(copy: AssistantCopy): HTMLElement {
  ensureChooserStyles();
  const choices = document.createElement('div');
  choices.className = 'scenaro-dock-choices';
  choices.inert = true;
  const inner = document.createElement('div');
  inner.className = 'scenaro-dock-choices-inner';
  const track = document.createElement('div');
  track.className = 'scenaro-dock-track';
  track.appendChild(Object.assign(document.createElement('div'), { className: 'scenaro-dock-bar' }));
  inner.append(
    track,
    choiceButton('chat', copy.chatLabel),
    choiceButton('immersive', copy.immersiveLabel),
  );
  choices.appendChild(inner);
  return choices;
}

export function buildChooser(copy: AssistantCopy, variant: 'popup' | 'sheet'): HTMLElement {
  ensureChooserStyles();
  const root = document.createElement('div');
  root.id = 'scenaro-chooser';
  root.className = 'scenaro-glass-card';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', variant === 'sheet' ? 'true' : 'false');
  root.setAttribute('aria-label', copy.name);
  const ms = motionMs(variant === 'sheet' ? 280 : 200);
  Object.assign(root.style, {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    width: variant === 'sheet' ? 'min(640px, 100%)' : '320px',
    margin: variant === 'sheet' ? '0 auto' : '0',
    padding: variant === 'sheet' ? '28px 20px max(20px, calc(env(safe-area-inset-bottom) + 16px))' : '18px',
    borderRadius: variant === 'sheet' ? '22px 22px 0 0' : '16px',
    fontFamily: 'Sora, Inter, system-ui, sans-serif',
    textAlign: 'left',
    opacity: '0',
    transform: variant === 'sheet' ? 'translateY(100%)' : 'translateY(8px)',
    transition: `opacity ${ms}ms ease, transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)`,
  });

  if (variant === 'sheet') {
    const grabber = document.createElement('span');
    grabber.setAttribute('aria-hidden', 'true');
    Object.assign(grabber.style, {
      position: 'absolute',
      top: '8px',
      left: '50%',
      width: '36px',
      height: '4px',
      marginLeft: '-18px',
      borderRadius: '999px',
      background: '#eceae6',
    });
    root.appendChild(grabber);
    root.style.position = 'relative';
  }

  const head = document.createElement('div');
  Object.assign(head.style, { display: 'flex', alignItems: 'center', gap: '12px' });
  const mark = document.createElement('span');
  mark.className = 'scenaro-glass-mark';
  mark.textContent = initial(copy.name);
  Object.assign(mark.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '999px',
    fontWeight: '700',
    fontSize: '16px',
    flex: '0 0 auto',
  });
  const titles = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = copy.name;
  Object.assign(name.style, { display: 'block', fontSize: '16px', lineHeight: '1.2' });
  const role = document.createElement('span');
  role.textContent = copy.role;
  Object.assign(role.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '3px',
    fontSize: '13px',
    lineHeight: '1.3',
    color: '#8a847c',
  });
  const dot = document.createElement('span');
  dot.dataset.scenaroAvailable = '1';
  Object.assign(dot.style, {
    width: '8px',
    height: '8px',
    borderRadius: '999px',
    background: '#1a1820',
    animation: 'scenaro-available 1.8s ease-in-out infinite',
    flex: '0 0 auto',
  });
  role.prepend(dot);
  titles.append(name, role);
  head.append(mark, titles);

  const choices = document.createElement('div');
  Object.assign(choices.style, { display: 'flex', flexDirection: 'column', gap: '8px' });
  choices.append(
    choiceButton('chat', copy.chatLabel),
    choiceButton('immersive', copy.immersiveLabel),
  );
  root.append(head, choices);
  return root;
}

export function buildWaiting(copy: AssistantCopy): HTMLElement {
  const block = document.createElement('div');
  Object.assign(block.style, {
    boxSizing: 'border-box',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '72px 28px',
    color: '#1a1820',
    fontFamily: 'Sora, Inter, system-ui, sans-serif',
  });
  const name = document.createElement('strong');
  name.textContent = copy.name;
  Object.assign(name.style, { fontSize: '22px', lineHeight: '1.2' });
  const line = document.createElement('p');
  line.textContent = copy.waiting;
  Object.assign(line.style, {
    margin: '8px 0 0',
    fontSize: '15px',
    lineHeight: '1.45',
    color: '#8a847c',
  });
  block.append(name, line);
  return block;
}

function choiceButton(action: 'chat' | 'immersive', label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'scenaro-glass-choice';
  button.dataset.scenaroChoice = action;
  const icon = document.createElement('span');
  icon.className = 'scenaro-choice-icon';
  icon.innerHTML = action === 'chat' ? penIcon() : ringIcon();
  const text = document.createElement('span');
  text.textContent = label;
  button.append(icon, text);
  Object.assign(button.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    minHeight: '42px',
    margin: '0',
    padding: '0 10px',
    border: '0',
    borderRadius: '8px',
    font: 'inherit',
    fontWeight: '500',
    fontSize: '14px',
    letterSpacing: '-.02em',
    textAlign: 'left',
    cursor: 'pointer',
  });
  return button;
}

function penIcon(): string {
  return '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true"><path d="M9.2 3.2 12.8 6.8 6.2 13.4H2.6V9.8L9.2 3.2Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/><path d="M8 4.4 11.6 8" stroke="currentColor" stroke-width="1.25"/></svg>';
}

function ringIcon(): string {
  return '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="5.25" stroke="currentColor" stroke-width="1.25"/><circle cx="8" cy="8" r="2.15" stroke="currentColor" stroke-width="1.25"/></svg>';
}

function initial(name: string): string {
  const letter = name.trim().charAt(0);
  return letter === '' ? 'S' : letter.toLocaleUpperCase();
}
