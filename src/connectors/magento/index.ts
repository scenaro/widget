import { Connector } from '../../types';

declare global {
  interface Window {
    customerData: {
      get(sectionName: string): () => any;
      reload(sections: string[], force?: boolean): void;
    };
    $: any; // jQuery
    requirejs: any;
    FORM_KEY?: string;
    mage?: {
      cookies?: {
        get(name: string): string | null;
      };
    };
  }
}

class CartCRUD {
  formKey(): string | null {
    try {
      if (typeof window.$ !== 'undefined' && window.$.mage && window.$.mage.cookies) {
        return window.$.mage.cookies.get('form_key') || window.FORM_KEY || null;
      }
      return window.FORM_KEY || null;
    } catch (error) {
      console.warn('[Scenaro] Error getting form_key:', error);
      return window.FORM_KEY || null;
    }
  }

  // Reload minicart + cache customer-data
  reload(): any {
    try {
      if (typeof window.customerData !== 'undefined') {
        window.customerData.reload(['cart'], true);
        return window.customerData.get('cart')();
      }
      return null;
    } catch (error) {
      console.error('[Scenaro] Error reloading cart:', error);
      return null;
    }
  }

  // LIST
  // Returns the customerData cart object (items, subtotal, summary_count, etc.)
  list(): any {
    try {
      if (typeof window.customerData === 'undefined') {
        console.warn('[Scenaro] Magento customerData not found.');
        return null;
      }
      const cart = window.customerData.get('cart')();
      console.log('[Scenaro] 🛒 cart:', cart);
      return cart;
    } catch (error) {
      console.error('[Scenaro] Error listing cart:', error);
      return null;
    }
  }

  // ADD (simple product)
  async add({ productId, qty = 1 }: { productId: string | number; qty?: number }): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (typeof window.$ === 'undefined') {
          reject(new Error('jQuery is not available'));
          return;
        }

        const formKey = this.formKey();
        if (!formKey) {
          reject(new Error('form_key is required'));
          return;
        }

        window.$.ajax({
          url: '/checkout/cart/add',
          type: 'POST',
          data: {
            product: String(productId),
            qty: String(qty),
            form_key: formKey
          },
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).done(() => {
          console.log(`[Scenaro] ✅ Added product ${productId} (qty ${qty})`);
          const cart = this.reload();
          resolve(cart);
        }).fail((xhr: any) => {
          const errorMsg = xhr.responseText?.slice(0, 300) || 'Unknown error';
          console.error(`[Scenaro] ❌ add failed`, xhr.status, errorMsg);
          reject(new Error(`Failed to add product: ${xhr.status} - ${errorMsg}`));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // UPDATE qty (par item_id du minicart)
  // itemId = cart.items[n].item_id
  async updateQty({ itemId, qty }: { itemId: string | number; qty: number }): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (typeof window.$ === 'undefined') {
          reject(new Error('jQuery is not available'));
          return;
        }

        const formKey = this.formKey();
        if (!formKey) {
          reject(new Error('form_key is required'));
          return;
        }

        // Magento attend souvent un payload du type cart[item_id][qty]
        const payload: any = {
          form_key: formKey
        };
        payload[`cart[${itemId}][qty]`] = String(qty);

        window.$.ajax({
          url: '/checkout/cart/updatePost',
          type: 'POST',
          data: payload,
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).done(() => {
          console.log(`[Scenaro] ✅ Updated item ${itemId} qty -> ${qty}`);
          const cart = this.reload();
          resolve(cart);
        }).fail((xhr: any) => {
          const errorMsg = xhr.responseText?.slice(0, 300) || 'Unknown error';
          console.error(`[Scenaro] ❌ updateQty failed`, xhr.status, errorMsg);
          reject(new Error(`Failed to update item: ${xhr.status} - ${errorMsg}`));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // DELETE item (par item_id du minicart)
  async remove({ itemId }: { itemId: string | number }): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (typeof window.$ === 'undefined') {
          reject(new Error('jQuery is not available'));
          return;
        }

        const formKey = this.formKey();
        if (!formKey) {
          reject(new Error('form_key is required'));
          return;
        }

        // Route standard Magento: /checkout/cart/delete/id/<itemId>/
        window.$.ajax({
          url: `/checkout/cart/delete/id/${itemId}/`,
          type: 'POST',
          data: { form_key: formKey },
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).done(() => {
          console.log(`[Scenaro] ✅ Removed item ${itemId}`);
          const cart = this.reload();
          resolve(cart);
        }).fail((xhr: any) => {
          const errorMsg = xhr.responseText?.slice(0, 300) || 'Unknown error';
          console.error(`[Scenaro] ❌ remove failed`, xhr.status, errorMsg);
          reject(new Error(`Failed to remove item: ${xhr.status} - ${errorMsg}`));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // CLEAR cart (supprime tout)
  // Note: il n'y a pas toujours un endpoint "clear" natif standard.
  // On le fait en supprimant tous les items un par un.
  async clear(): Promise<void> {
    try {
      const cart = this.list();
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
        if (typeof window.customerData !== 'undefined') {
            console.log('[Scenaro] Refreshing Magento cart...');
            window.customerData.reload(['cart'], true);
        }
    } catch (error) {
        console.error('[Scenaro] Error refreshing Magento cart:', error);
    }
  },

  async listCart(): Promise<any> {
    try {
      return cartCRUD.list();
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
