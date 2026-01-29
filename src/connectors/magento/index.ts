import { Connector } from '../../types';

// jQuery interface for Magento AMD loading
interface MagentoJQuery {
  ajax(settings: any): any;
  mage?: {
    cookies?: {
      get(name: string): string | null;
    };
  };
}

declare global {
  interface Window {
    $: any; // jQuery (global fallback)
    requirejs: any;
    FORM_KEY?: string;
  }
}

class CartCRUD {
  // Load Magento dependencies via AMD
  loadMagentoDeps(): Promise<{ $: MagentoJQuery; customerData: any }> {
    return new Promise((resolve, reject) => {
      if (typeof window.requirejs === 'undefined') {
        reject(new Error('requirejs not available - not on Magento page'));
        return;
      }

      window.requirejs([
        'jquery',
        'Magento_Customer/js/customer-data'
      ], function ($: MagentoJQuery, customerData: any) {
        resolve({ $, customerData });
      }, function (error: any) {
        reject(new Error(`Failed to load Magento dependencies: ${error}`));
      });
    });
  }

  async formKey($: MagentoJQuery): Promise<string | null> {
    try {
      if ($.mage && $.mage.cookies) {
        return $.mage.cookies.get('form_key') || window.FORM_KEY || null;
      }
      return window.FORM_KEY || null;
    } catch (error) {
      console.warn('[Scenaro] Error getting form_key:', error);
      return window.FORM_KEY || null;
    }
  }

  // Reload minicart + cache customer-data
  async reload(customerData: any): Promise<any> {
    try {
      customerData.reload(['cart'], true);
      return customerData.get('cart')();
    } catch (error) {
      console.error('[Scenaro] Error reloading cart:', error);
      return null;
    }
  }

  // LIST
  // Returns the customerData cart object (items, subtotal, summary_count, etc.)
  async list(): Promise<any> {
    try {
      const { customerData } = await this.loadMagentoDeps();
      const cart = customerData.get('cart')();
      console.log('[Scenaro] 🛒 cart:', cart);
      return cart;
    } catch (error) {
      console.error('[Scenaro] Error listing cart:', error);
      throw error;
    }
  }

  // ADD (simple product)
  async add({ productId, qty = 1 }: { productId: string | number; qty?: number }): Promise<any> {
    try {
      const { $, customerData } = await this.loadMagentoDeps();
      const formKey = await this.formKey($);

      if (!formKey) {
        throw new Error('form_key is required');
      }

      return new Promise((resolve, reject) => {
        $.ajax({
          url: '/checkout/cart/add',
          type: 'POST',
          data: {
            product: String(productId),
            qty: String(qty),
            form_key: formKey
          },
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).done(async () => {
          console.log(`[Scenaro] ✅ Added product ${productId} (qty ${qty})`);
          const cart = await this.reload(customerData);
          resolve(cart);
        }).fail((xhr: any) => {
          const errorMsg = xhr.responseText?.slice(0, 300) || 'Unknown error';
          console.error(`[Scenaro] ❌ add failed`, xhr.status, errorMsg);
          reject(new Error(`Failed to add product: ${xhr.status} - ${errorMsg}`));
        });
      });
    } catch (error) {
      console.error('[Scenaro] Error in add operation:', error);
      throw error;
    }
  }

  // UPDATE qty (par item_id du minicart)
  // itemId = cart.items[n].item_id
  async updateQty({ itemId, qty }: { itemId: string | number; qty: number }): Promise<any> {
    try {
      const { $, customerData } = await this.loadMagentoDeps();
      const formKey = await this.formKey($);

      if (!formKey) {
        throw new Error('form_key is required');
      }

      // Magento attend souvent un payload du type cart[item_id][qty]
      const payload: any = {
        form_key: formKey
      };
      payload[`cart[${itemId}][qty]`] = String(qty);

      return new Promise((resolve, reject) => {
        $.ajax({
          url: '/checkout/cart/updatePost',
          type: 'POST',
          data: payload,
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).done(async () => {
          console.log(`[Scenaro] ✅ Updated item ${itemId} qty -> ${qty}`);
          const cart = await this.reload(customerData);
          resolve(cart);
        }).fail((xhr: any) => {
          const errorMsg = xhr.responseText?.slice(0, 300) || 'Unknown error';
          console.error(`[Scenaro] ❌ updateQty failed`, xhr.status, errorMsg);
          reject(new Error(`Failed to update item: ${xhr.status} - ${errorMsg}`));
        });
      });
    } catch (error) {
      console.error('[Scenaro] Error in updateQty operation:', error);
      throw error;
    }
  }

  // DELETE item (par item_id du minicart)
  async remove({ itemId }: { itemId: string | number }): Promise<any> {
    try {
      const { $, customerData } = await this.loadMagentoDeps();
      const formKey = await this.formKey($);

      if (!formKey) {
        throw new Error('form_key is required');
      }

      // Route standard Magento: /checkout/cart/delete/id/<itemId>/
      return new Promise((resolve, reject) => {
        $.ajax({
          url: `/checkout/cart/delete/id/${itemId}/`,
          type: 'POST',
          data: { form_key: formKey },
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).done(async () => {
          console.log(`[Scenaro] ✅ Removed item ${itemId}`);
          const cart = await this.reload(customerData);
          resolve(cart);
        }).fail((xhr: any) => {
          const errorMsg = xhr.responseText?.slice(0, 300) || 'Unknown error';
          console.error(`[Scenaro] ❌ remove failed`, xhr.status, errorMsg);
          reject(new Error(`Failed to remove item: ${xhr.status} - ${errorMsg}`));
        });
      });
    } catch (error) {
      console.error('[Scenaro] Error in remove operation:', error);
      throw error;
    }
  }

  // CLEAR cart (supprime tout)
  // Note: il n'y a pas toujours un endpoint "clear" natif standard.
  // On le fait en supprimant tous les items un par un.
  async clear(): Promise<void> {
    try {
      const cart = await this.list();
      const items = cart?.items || [];

      // Remove all items sequentially
      for (const item of items) {
        if (item.item_id) {
          await this.remove({ itemId: item.item_id });
        }
      }

      console.log('[Scenaro] 🧹 Cart cleared');
    } catch (error) {
      console.error('[Scenaro] Error clearing cart:', error);
      throw error;
    }
  }
}

const cartCRUD = new CartCRUD();

export const MagentoConnector: Connector = {
  name: 'magento',

  async refreshCart(): Promise<void> {
    try {
      console.log('[Scenaro] Refreshing Magento cart...');
      const { customerData } = await cartCRUD.loadMagentoDeps();
      customerData.reload(['cart'], true);
    } catch (error) {
      console.error('[Scenaro] Error refreshing Magento cart:', error);
    }
  },

  async listCart(): Promise<any> {
    try {
      return await cartCRUD.list();
    } catch (error) {
      console.error('[Scenaro] Error listing cart:', error);
      throw error;
    }
  },

  async addToCart(params: { productId: string | number; qty?: number }): Promise<any> {
    try {
      return await cartCRUD.add(params);
    } catch (error) {
      console.error('[Scenaro] Error adding to cart:', error);
      throw error;
    }
  },

  async updateCart(params: { itemId: string | number; qty: number }): Promise<any> {
    try {
      return await cartCRUD.updateQty(params);
    } catch (error) {
      console.error('[Scenaro] Error updating cart item:', error);
      throw error;
    }
  },

  async removeCart(params: { itemId: string | number }): Promise<any> {
    try {
      return await cartCRUD.remove(params);
    } catch (error) {
      console.error('[Scenaro] Error removing cart item:', error);
      throw error;
    }
  },

  async clearCart(): Promise<void> {
    try {
      await cartCRUD.clear();
    } catch (error) {
      console.error('[Scenaro] Error clearing cart:', error);
      throw error;
    }
  }
};
