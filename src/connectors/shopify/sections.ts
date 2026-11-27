/** Apply confirmed Shopify section HTML while preserving the theme's controls. */
export function applyCartSections(sections: Record<string, unknown>): void {
  for (const [id, html] of Object.entries(sections)) {
    if (typeof html !== 'string' || !html) continue;
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    if (id === 'cart-drawer') {
      const drawer = document.querySelector<HTMLElement>('cart-drawer');
      const next = parsed.querySelector('cart-drawer');
      if (drawer && next) {
        // Keep the existing custom element and its header/Escape listeners.
        // Recreating it would leave header handlers bound to a detached drawer.
        drawer.innerHTML = next.innerHTML;
        drawer.classList.toggle('is-empty', next.classList.contains('is-empty'));
        const close = (drawer as HTMLElement & { close?: () => void }).close;
        if (typeof close === 'function') {
          drawer.querySelector('#CartDrawer-Overlay')?.addEventListener('click', () => close.call(drawer));
        }
        continue;
      }
    }

    if (id === 'cart-icon-bubble') {
      const icon = document.getElementById(id);
      const next = parsed.getElementById(id) || parsed.getElementById(`shopify-section-${id}`);
      if (icon && next) {
        icon.innerHTML = next.innerHTML;
        continue;
      }
    }

    const current = document.getElementById(`shopify-section-${id}`);
    const next = parsed.getElementById(`shopify-section-${id}`);
    if (current && next) current.replaceWith(next);
  }
}
