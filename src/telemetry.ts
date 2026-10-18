import { apiOrigin } from './embed-origin';

const counters = new Map<string, number>();

function scriptSrc(): string | undefined {
  const current = document.currentScript;
  if (current instanceof HTMLScriptElement) return current.src;
  const tagged = document.querySelector('script[data-publication], script[src*="widget.js"]');
  return tagged instanceof HTMLScriptElement ? tagged.src : undefined;
}

function report(name: string, tags: Record<string, string> = {}, kind = 'counter', value = 1): void {
  const origin = apiOrigin(scriptSrc());
  fetch(`${origin}/v1/public/telemetry`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      service: 'widget',
      metrics: [{ name, kind, value, tags }],
    }),
    keepalive: true,
  }).catch(() => undefined);
}

export function counter(name: string, value = 1, tags: Record<string, string> = {}): void {
  const key = JSON.stringify([name, tags]);
  const next = (counters.get(key) || 0) + value;
  counters.set(key, next);
  report(name, tags, 'counter', value);
}

export function installWidgetTelemetry(): void {
  const marker = '__scenaro_widget_telemetry';
  if ((globalThis as Record<string, unknown>)[marker]) return;
  (globalThis as Record<string, unknown>)[marker] = true;
  counter('widget.boot', 1, { version: 'widget' });
  addEventListener('error', () => counter('widget.error', 1, { kind: 'error' }));
}
