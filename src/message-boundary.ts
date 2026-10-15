import type { ScenaroEventPayload } from './types';

export function iframeOrigin(iframe: HTMLIFrameElement | null): string | null {
  if (!iframe) return null;
  try {
    const url = new URL(iframe.src);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}

export function isIframeMessage(event: MessageEvent, iframe: HTMLIFrameElement | null): boolean {
  const origin = iframeOrigin(iframe);
  return origin !== null && iframe?.contentWindow != null &&
    event.source === iframe.contentWindow && event.origin === origin;
}

export function postToIframe(iframe: HTMLIFrameElement | null, payload: unknown): void {
  const origin = iframeOrigin(iframe);
  if (origin) iframe?.contentWindow?.postMessage(payload, origin);
}

const identifier = (value: unknown): boolean =>
  (typeof value === 'string' && value.trim().length > 0) ||
  (typeof value === 'number' && Number.isSafeInteger(value) && value > 0);
const quantity = (value: unknown, minimum: number): boolean =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;

export function isWidgetPayload(value: unknown): value is ScenaroEventPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  if (typeof payload.type !== 'string') return false;
  if (['SCENARO_READY', 'SCENARO_END'].includes(payload.type)) return true;
  if (payload.type === 'SCENARO_REDIRECT') return typeof payload.url === 'string';
  if (typeof payload.requestId !== 'string' || !payload.requestId.trim()) return false;
  if (payload.type === 'SCENARO_CAPABILITY_REQUEST') {
    return Array.isArray(payload.capabilities) && payload.capabilities.every(c => typeof c === 'string') &&
      (payload.adapter === undefined || ['shopify', 'magento'].includes(payload.adapter as string));
  }
  if (['SCENARO_CART_LIST_REQUEST', 'SCENARO_CART_CLEAR_REQUEST'].includes(payload.type)) return true;
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) return false;
  const data = payload.data as Record<string, unknown>;
  switch (payload.type) {
    case 'SCENARO_CART_ADD_REQUEST':
      return identifier(data.productId) && (data.variantId === undefined || identifier(data.variantId)) &&
        (data.qty === undefined || quantity(data.qty, 1));
    case 'SCENARO_CART_UPDATE_REQUEST':
      return identifier(data.itemId) && quantity(data.qty, 0);
    case 'SCENARO_CART_REMOVE_REQUEST':
      return identifier(data.itemId);
    default:
      return false;
  }
}

export function redirectUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
