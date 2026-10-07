export type StorefrontKind = 'shopify' | 'magento';

/** Which storefront page the widget is running on. Shopify wins when both signals exist. */
export function detectStorefront(): StorefrontKind | null {
  if (typeof window === 'undefined') return null;
  const shopify = (window as Window & { Shopify?: { shop?: string; theme?: unknown } }).Shopify;
  if (shopify && (shopify.shop || shopify.theme)) return 'shopify';
  if ((window as Window & { requirejs?: unknown }).requirejs) return 'magento';
  return null;
}
