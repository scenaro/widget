import { detectStorefront } from './storefront';

/** Keep storefront launchers above Shopify's merchant-only preview toolbar. */
export function avoidShopifyPreviewBar(launcher: HTMLElement): () => void {
  if (detectStorefront() !== 'shopify') return () => {};
  const property = '--scenaro-preview-bar-height';
  const original = launcher.style.getPropertyValue(property);
  let observed: HTMLElement | null = null;
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);

  function update() {
    // The iframe is a transparent full-viewport document. Its popover wrapper
    // is the actual toolbar footprint; measuring the iframe would hide the CTA.
    const bar = document.getElementById('PBarNextFrameWrapper');
    if (bar !== observed) {
      resize?.disconnect();
      observed = bar;
      if (bar) resize?.observe(bar);
    }
    const rect = bar?.getBoundingClientRect();
    const viewport = window.innerHeight;
    const clearance = rect && rect.height > 0 && rect.top >= viewport / 2 &&
      rect.top < viewport && rect.bottom >= viewport - 1
      ? Math.ceil(viewport - rect.top) : 0;
    if (clearance) launcher.style.setProperty(property, `${clearance}px`);
    else if (original) launcher.style.setProperty(property, original);
    else launcher.style.removeProperty(property);
  }

  // Shopify can inject or remove the wrapper after the deferred widget loads.
  const changes = new MutationObserver(update);
  changes.observe(document.body, { childList: true });
  window.addEventListener('resize', update, { passive: true });
  update();
  return () => {
    changes.disconnect();
    resize?.disconnect();
    window.removeEventListener('resize', update);
    if (original) launcher.style.setProperty(property, original);
    else launcher.style.removeProperty(property);
  };
}
