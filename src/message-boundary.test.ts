// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWidgetPayload, postToIframe, redirectUrl } from './message-boundary';
import { ScenaroWidget } from './widget';

afterEach(() => document.body.replaceChildren());

describe('widget message dispatch', () => {
  it('only forwards requests from the active iframe and its configured origin', () => {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://experience.example/shop';
    const other = document.createElement('iframe');
    document.body.append(iframe, other);
    const handleCartRequest = vi.fn();
    const widget = Object.assign(Object.create(ScenaroWidget.prototype), {
      iframe, engine: { handleCartRequest },
    });
    const data = { type: 'SCENARO_CART_ADD_REQUEST', requestId: 'r1', data: { productId: 'p1', qty: 1 } };
    const deliver = (source: Window | null, origin: string, payload: unknown = data) =>
      widget.handleMessage(new MessageEvent('message', { source, origin, data: payload }));

    deliver(other.contentWindow, 'https://experience.example');
    deliver(iframe.contentWindow, 'https://attacker.example');
    deliver(iframe.contentWindow, 'null');
    deliver(iframe.contentWindow, 'https://experience.example', null);
    deliver(iframe.contentWindow, 'https://experience.example', { ...data, data: { productId: 'p1', qty: -1 } });
    expect(handleCartRequest).not.toHaveBeenCalled();
    deliver(iframe.contentWindow, 'https://experience.example');
    expect(handleCartRequest).toHaveBeenCalledTimes(1);
    expect(handleCartRequest).toHaveBeenCalledWith(data);
    widget.iframe = null;
    deliver(iframe.contentWindow, 'https://experience.example');
    expect(handleCartRequest).toHaveBeenCalledTimes(1);
  });

  it('targets replies at the configured iframe origin', () => {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://experience.example/shop';
    document.body.append(iframe);
    const send = vi.spyOn(iframe.contentWindow!, 'postMessage');
    postToIframe(iframe, { type: 'SCENARO_METADATA' });
    expect(send).toHaveBeenCalledWith({ type: 'SCENARO_METADATA' }, 'https://experience.example');
    iframe.src = 'about:blank';
    postToIframe(iframe, { secret: 'must not send' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('payload validation', () => {
  it.each([null, [], 'text', {}, { type: 'SCENARO_CAPABILITY_REQUEST', requestId: 'a', capabilities: 'cart' },
    { type: 'SCENARO_CAPABILITY_REQUEST', requestId: 'a', capabilities: ['cart'], adapter: '../other' },
    { type: 'SCENARO_CART_REMOVE_REQUEST', requestId: '', data: { itemId: 'x' } },
    { type: 'SCENARO_CART_UPDATE_REQUEST', requestId: 'a', data: { itemId: 'x', qty: Infinity } },
    { type: 'SCENARO_CART_ADD_REQUEST', requestId: 'a', data: { productId: 'x', qty: 0 } },
  ])('rejects malformed commands: %j', payload => expect(isWidgetPayload(payload)).toBe(false));

  it('accepts quantity zero for removal through update and defaults for add', () => {
    expect(isWidgetPayload({ type: 'SCENARO_CART_UPDATE_REQUEST', requestId: 'a', data: { itemId: 'x', qty: 0 } })).toBe(true);
    expect(isWidgetPayload({ type: 'SCENARO_CART_ADD_REQUEST', requestId: 'a', data: { productId: 'x' } })).toBe(true);
  });
});

describe('redirects', () => {
  it.each(['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'https://user:password@example.com'])('rejects %s', url => {
    expect(redirectUrl(url, 'https://shop.example')).toBeNull();
  });
  it('supports relative shop links and HTTPS checkout links', () => {
    expect(redirectUrl('/checkout', 'https://shop.example/cart')).toBe('https://shop.example/checkout');
    expect(redirectUrl('https://checkout.example/cart', 'https://shop.example')).toBe('https://checkout.example/cart');
  });
});
