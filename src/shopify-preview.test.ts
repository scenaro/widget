// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { avoidShopifyPreviewBar } from './shopify-preview';

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

describe('Shopify preview toolbar clearance', () => {
  it('tracks the toolbar wrapper, including late injection, resizing and removal', async () => {
    vi.stubGlobal('Shopify', { shop: 'qa.myshopify.com' });
    let notifyResize = () => {};
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { notifyResize = callback; }
      observe() {}
      disconnect() {}
    });
    const launcher = document.createElement('div');
    document.body.append(launcher);
    const dispose = avoidShopifyPreviewBar(launcher);
    expect(launcher.style.getPropertyValue('--scenaro-preview-bar-height')).toBe('');
    const bar = document.createElement('div');
    bar.id = 'PBarNextFrameWrapper';
    let height = 68;
    bar.getBoundingClientRect = () => new DOMRect(0, window.innerHeight - height, 1024, height);
    const frame = document.createElement('iframe');
    frame.id = 'PBarNextFrame';
    frame.getBoundingClientRect = () => new DOMRect(0, 0, 1024, window.innerHeight);
    bar.append(frame);
    document.body.append(bar);
    await Promise.resolve();
    expect(launcher.style.getPropertyValue('--scenaro-preview-bar-height')).toBe('68px');
    height = 110;
    notifyResize();
    expect(launcher.style.getPropertyValue('--scenaro-preview-bar-height')).toBe('110px');
    height = 0;
    notifyResize();
    expect(launcher.style.getPropertyValue('--scenaro-preview-bar-height')).toBe('');
    height = 68;
    notifyResize();
    bar.remove();
    await Promise.resolve();
    expect(launcher.style.getPropertyValue('--scenaro-preview-bar-height')).toBe('');
    dispose();
  });

  it('leaves Magento launchers and their positioning unchanged', () => {
    vi.stubGlobal('Shopify', undefined);
    vi.stubGlobal('requirejs', () => {});
    const observe = vi.fn();
    vi.stubGlobal('ResizeObserver', class { constructor() { observe(); } });
    const launcher = document.createElement('div');
    launcher.style.bottom = '17px';
    avoidShopifyPreviewBar(launcher)();
    expect(launcher.style.bottom).toBe('17px');
    expect(launcher.style.getPropertyValue('--scenaro-preview-bar-height')).toBe('');
    expect(observe).not.toHaveBeenCalled();
  });
});
