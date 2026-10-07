import { Connector } from '../../types';
import { normalizeShopifyCart, shopifyVariantId, StorefrontCart } from '../cart';

interface ShopifyAjaxItem {
  id: string | number;
  quantity: number;
}

async function shopifyCart<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify cart ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json() as Promise<T>;
}

async function readCart(): Promise<StorefrontCart> {
  const cart = await shopifyCart('/cart.js');
  return normalizeShopifyCart(cart);
}

/** Ask the theme to redraw the drawer from the cart cookie we just changed. */
async function refreshThemeCart(): Promise<void> {
  document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
  try {
    const response = await fetch('/?sections=cart-drawer,cart-icon-bubble', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return;
    const sections = await response.json() as Record<string, string>;
    for (const [id, html] of Object.entries(sections)) {
      if (typeof html !== 'string' || html === '') continue;
      const current = document.getElementById(`shopify-section-${id}`);
      if (!current) continue;
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const next = parsed.getElementById(`shopify-section-${id}`);
      if (next) current.replaceWith(next);
    }
  } catch (error) {
    console.warn('[Scenaro] Shopify cart section refresh skipped:', error);
  }
}

async function mutate(path: string, body: unknown): Promise<StorefrontCart> {
  await shopifyCart(path, { method: 'POST', body: JSON.stringify(body) });
  const cart = await readCart();
  await refreshThemeCart();
  return cart;
}

export const ShopifyConnector: Connector = {
  name: 'shopify',

  async refreshCart(): Promise<void> {
    await refreshThemeCart();
  },

  async listCart(): Promise<StorefrontCart> {
    return readCart();
  },

  async addToCart(params: { productId: string | number; variantId?: string | number; qty?: number }): Promise<StorefrontCart> {
    const variantId = shopifyVariantId(params);
    const item: ShopifyAjaxItem = {
      id: /^\d+$/.test(variantId) ? Number(variantId) : variantId,
      quantity: params.qty ?? 1,
    };
    return mutate('/cart/add.js', { items: [item] });
  },

  async updateCart(params: { itemId: string | number; qty: number }): Promise<StorefrontCart> {
    return mutate('/cart/change.js', { id: String(params.itemId), quantity: params.qty });
  },

  async removeCart(params: { itemId: string | number }): Promise<StorefrontCart> {
    return mutate('/cart/change.js', { id: String(params.itemId), quantity: 0 });
  },

  async clearCart(): Promise<StorefrontCart> {
    return mutate('/cart/clear.js', {});
  },
};
