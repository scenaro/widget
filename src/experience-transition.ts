const readiness = new WeakMap<HTMLIFrameElement, Promise<void>>();

/** Register before mounting: even a cached document can load before the cover finishes. */
export function whenIframeReady(iframe: HTMLIFrameElement, timeoutMs = 10000): Promise<void> {
  const existing = readiness.get(iframe);
  if (existing) return existing;
  const promise = new Promise<void>(resolve => {
    let settled = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout); clearTimeout(fallback);
      iframe.removeEventListener('load', loaded);
      window.removeEventListener('message', received);
      resolve();
    };
    const received = (event: MessageEvent) => {
      if (event.source === iframe.contentWindow && event.origin === new URL(iframe.src).origin && event.data?.type === 'SCENARO_VIEW_READY') finish();
    };
    const loaded = () => {
      // Older experiences remain compatible without implementing the visual handshake.
      fallback = setTimeout(finish, 800);
    };
    const timeout = setTimeout(finish, timeoutMs);
    window.addEventListener('message', received);
    iframe.addEventListener('load', loaded, { once: true });
  });
  readiness.set(iframe, promise);
  return promise;
}

/** Put the experience under the loader. The entrance stays held until presentExperience. */
export function showExperience(iframe: HTMLIFrameElement) {
  iframe.style.opacity = '1';
}

/** Start the entrance only once the loader has left. */
export function presentExperience(iframe: HTMLIFrameElement) {
  iframe.contentWindow?.postMessage({ type: 'SCENARO_PRESENT' }, new URL(iframe.src).origin);
}

export function revealExperience(iframe: HTMLIFrameElement) {
  showExperience(iframe);
  presentExperience(iframe);
}
