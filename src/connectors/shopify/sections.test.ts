// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyCartSections } from './sections';
import { ShopifyConnector } from './index';

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

const filled = {
  'cart-drawer': '<div id="shopify-section-cart-drawer"><cart-drawer class="drawer"><div id="CartDrawer"><div id="CartDrawer-Overlay"></div><div>The Complete Snowboard · 1 · $699.95</div></div></cart-drawer></div>',
  'cart-icon-bubble': '<div id="shopify-section-cart-icon-bubble"><span>Cart 1</span></div>',
};

function emptyTheme() {
  document.body.innerHTML = '<a id="cart-icon-bubble">Cart</a><cart-drawer class="drawer is-empty"><div id="CartDrawer"><div id="CartDrawer-Overlay"></div><h2>Your cart is empty</h2></div></cart-drawer>';
}

describe('Shopify native cart section refresh', () => {
  it('updates Dawn snippet roots without replacing controls or opening the drawer', () => {
    emptyTheme();
    const drawer = document.querySelector('cart-drawer') as HTMLElement & { close: () => void };
    const icon = document.getElementById('cart-icon-bubble')!;
    const open = vi.fn();
    const close = vi.fn();
    drawer.close = close;
    icon.addEventListener('click', open);
    applyCartSections(filled);
    expect(document.querySelector('cart-drawer')).toBe(drawer);
    expect(document.getElementById('cart-icon-bubble')).toBe(icon);
    expect(drawer.textContent).toContain('The Complete Snowboard');
    expect(drawer.classList.contains('is-empty')).toBe(false);
    expect(drawer.classList.contains('active')).toBe(false);
    expect(icon.textContent).toBe('Cart 1');
    icon.click();
    expect(open).toHaveBeenCalledTimes(1);
    drawer.querySelector<HTMLElement>('#CartDrawer-Overlay')!.click();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('restores empty state and keeps supporting wrapped sections and absent sections', () => {
    emptyTheme();
    applyCartSections(filled);
    document.body.insertAdjacentHTML('beforeend', '<div id="shopify-section-other">old</div>');
    applyCartSections({
      'cart-drawer': '<cart-drawer class="drawer is-empty"><div id="CartDrawer">Your cart is empty</div></cart-drawer>',
      other: '<div id="shopify-section-other">new</div>',
      missing: null,
    });
    expect(document.querySelector('cart-drawer')?.classList.contains('is-empty')).toBe(true);
    expect(document.getElementById('shopify-section-other')?.textContent).toBe('new');
  });

  it('refreshes native UI after one successful add without replaying the cart mutation', async () => {
    emptyTheme();
    const fetch = vi.fn(async (path: string) => {
      if (path === '/cart/add.js') return new Response(JSON.stringify({ items: [] }));
      if (path === '/cart.js') return new Response(JSON.stringify({ item_count: 1, total_price: 69995, currency: 'USD', items: [{ id: 123, key: '123:key', quantity: 1, product_title: 'The Complete Snowboard', price: 69995 }] }));
      if (path === '/?sections=cart-drawer,cart-icon-bubble') return new Response(JSON.stringify(filled));
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetch);
    const cart = await ShopifyConnector.addToCart!({productId: 456, variantId: 123, qty: 1}) as {itemCount: number};
    expect(cart.itemCount).toBe(1);
    expect(document.querySelector('cart-drawer')?.textContent).toContain('The Complete Snowboard');
    expect(fetch.mock.calls.filter(([path]) => path === '/cart/add.js')).toHaveLength(1);
  });
});
