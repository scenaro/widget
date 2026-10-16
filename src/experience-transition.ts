const readiness = new WeakMap<HTMLIFrameElement, Promise<void>>();

/** Register before src is set: the experience can answer before the cover finishes. */
export function whenIframeReady(iframe: HTMLIFrameElement, timeoutMs = 10000): Promise<void> {
  const existing = readiness.get(iframe);
  if (existing) return existing;
  const promise = new Promise<void>(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.removeEventListener('message', received);
      resolve();
    };
    const received = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow || event.data?.type !== 'SCENARO_VIEW_READY') return;
      if (!iframe.src) return;
      let origin = '';
      try {
        origin = new URL(iframe.src).origin;
      } catch {
        return;
      }
      if (event.origin === origin) finish();
    };
    const timeout = setTimeout(finish, timeoutMs);
    window.addEventListener('message', received);
  });
  readiness.set(iframe, promise);
  return promise;
}

/** Put the experience under the loader. The entrance stays held until presentExperience. */
export function showExperience(iframe: HTMLIFrameElement) {
  // Only the cover fades, so the shop cannot bleed through two translucent layers.
  iframe.style.transition = 'none';
  iframe.style.opacity = '1';
  iframe.style.background = '#fff';
}

/** Start the entrance only once the loader has left. */
export function presentExperience(iframe: HTMLIFrameElement) {
  if (!iframe.src || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage({ type: 'SCENARO_PRESENT' }, new URL(iframe.src).origin);
}

export function revealExperience(iframe: HTMLIFrameElement) {
  showExperience(iframe);
  presentExperience(iframe);
}

export async function prepareExperience(iframe: HTMLIFrameElement) {
  showExperience(iframe);
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  presentExperience(iframe);
}

export function requestedCloseVisibility(event: MessageEvent, iframe: HTMLIFrameElement | null): boolean | null {
  if(!iframe || event.source!==iframe.contentWindow || event.origin!==new URL(iframe.src).origin) return null;
  if(event.data?.type!=='SCENARO_CLOSE_VISIBILITY' || typeof event.data.visible!=='boolean') return null;
  return event.data.visible;
}
