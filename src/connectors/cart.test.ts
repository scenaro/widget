import { describe, expect, it } from 'vitest';
import { normalizeMagentoCart, normalizeShopifyCart, shopifyVariantId } from './cart';

describe('shopifyVariantId', () => {
  it('prefers the synced variant id over the product id', () => {
    expect(shopifyVariantId({ productId: '100', variantId: '200' })).toBe('200');
  });

  it('uses productId when the caller already passed the variant id there', () => {
    expect(shopifyVariantId({ productId: 442211 })).toBe('442211');
  });

  it('refuses an empty id', () => {
    expect(() => shopifyVariantId({ productId: '  ' })).toThrow(/variant id/);
  });
});

describe('normalizeShopifyCart', () => {
  it('converts cents and keeps the line key used for updates', () => {
    const cart = normalizeShopifyCart({
      currency: 'EUR',
      item_count: 2,
      items_subtotal_price: 4500,
      items: [{
        key: '442211:abc',
        product_id: 10,
        variant_id: 442211,
        product_title: 'Nuit',
        quantity: 2,
        sku: 'NUIT',
        price: 2250,
      }],
    });
    expect(cart).toMatchObject({
      source: 'shopify',
      itemCount: 2,
      subtotal: 45,
      currency: 'EUR',
      items: [{
        id: '442211:abc',
        productId: '10',
        variantId: '442211',
        title: 'Nuit',
        qty: 2,
        sku: 'NUIT',
        price: 22.5,
      }],
    });
  });
});

describe('normalizeMagentoCart', () => {
  it('keeps the minicart item id used for updates', () => {
    const cart = normalizeMagentoCart({
      summary_count: 1,
      subtotalAmount: 19.9,
      items: [{
        item_id: 77,
        product_id: 12,
        product_name: 'Jour',
        qty: 1,
        product_sku: 'JOUR',
        product_price_value: 19.9,
      }],
    });
    expect(cart).toMatchObject({
      source: 'magento',
      itemCount: 1,
      subtotal: 19.9,
      items: [{
        id: '77',
        productId: '12',
        variantId: '',
        title: 'Jour',
        qty: 1,
        sku: 'JOUR',
        price: 19.9,
      }],
    });
  });
});
