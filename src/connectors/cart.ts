/** Cart the iframe can read the same way on Magento and Shopify. Prices are in major currency units. */
export interface StorefrontCartLine {
  /** Line id passed back to update and remove. Magento item_id, Shopify line key. */
  id: string;
  productId: string;
  variantId: string;
  title: string;
  qty: number;
  sku: string;
  price: number | null;
  /** Existing commerce iframe field names; Shopify line key must survive round trips. */
  item_id?: string;
  product_id?: string;
  product_sku?: string;
}

export interface StorefrontCart {
  source: 'shopify' | 'magento';
  items: StorefrontCartLine[];
  itemCount: number;
  subtotal: number | null;
  currency: string | null;
  raw: unknown;
}

export function emptyCart(source: StorefrontCart['source'], raw: unknown = null): StorefrontCart {
  return { source, items: [], itemCount: 0, subtotal: null, currency: null, raw };
}

/** Id posted to the storefront. A variant id wins, on Shopify and on Magento. */
export function cartAddId(params: { productId?: string | number; variantId?: string | number }): string {
  const id = params.variantId ?? params.productId;
  if (id === undefined || id === null || String(id).trim() === '') {
    throw new Error('Cart add requires a variant or product id');
  }
  return String(id).trim();
}

export const shopifyVariantId = cartAddId;

function moneyFromCents(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n / 100;
}

function money(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function normalizeShopifyCart(cart: any): StorefrontCart {
  if (!cart || typeof cart !== 'object') return emptyCart('shopify', cart ?? null);
  const items = Array.isArray(cart.items) ? cart.items.map((item: any) => ({
    id: String(item?.key ?? item?.id ?? ''),
    productId: String(item?.product_id ?? ''),
    variantId: String(item?.variant_id ?? item?.id ?? ''),
    title: String(item?.product_title || item?.title || ''),
    qty: Number(item?.quantity ?? 0),
    // Catalogue rows also use the handle when the variant has no SKU.
    sku: String(item?.sku || item?.handle || ''),
    item_id: String(item?.key ?? item?.id ?? ''),
    product_id: String(item?.product_id ?? ''),
    product_sku: String(item?.sku || item?.handle || ''),
    price: moneyFromCents(item?.price),
  })) : [];
  return {
    source: 'shopify',
    items,
    itemCount: Number(cart.item_count ?? items.reduce((sum: number, line: StorefrontCartLine) => sum + line.qty, 0)),
    subtotal: moneyFromCents(cart.items_subtotal_price ?? cart.total_price),
    currency: cart.currency ? String(cart.currency) : null,
    raw: cart,
  };
}

export function normalizeMagentoCart(cart: any): StorefrontCart {
  if (!cart || typeof cart !== 'object') return emptyCart('magento', cart ?? null);
  const items = Array.isArray(cart.items) ? cart.items.map((item: any) => ({
    id: String(item?.item_id ?? ''),
    productId: String(item?.product_id ?? ''),
    variantId: '',
    title: String(item?.product_name ?? item?.product_title ?? ''),
    qty: Number(item?.qty ?? 0),
    sku: String(item?.product_sku ?? ''),
    price: money(item?.product_price_value),
  })) : [];
  return {
    source: 'magento',
    items,
    itemCount: Number(cart.summary_count ?? items.reduce((sum: number, line: StorefrontCartLine) => sum + line.qty, 0)),
    subtotal: money(cart.subtotalAmount),
    currency: cart.currency_code ? String(cart.currency_code) : null,
    raw: cart,
  };
}
