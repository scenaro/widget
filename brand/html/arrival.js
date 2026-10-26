import { MARK_PATH, VIEWBOX } from '../geometry.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

/** Exact Commerce “au passage” arrival. One play; no reset or minimum wait. */
export function scenaroArrivalMarkup({ size = 'standard', label = '' } = {}) {
  const safeSize = ['compact', 'standard', 'large'].includes(size) ? size : 'standard';
  return `<div class="scenaro-loader scenaro-loader--arrival scenaro-loader--${safeSize} scenaro-loader--light" role="status" aria-live="polite" aria-busy="true"><span class="scenaro-loader__row scenaro-arrival-stage" aria-hidden="true"><span class="scenaro-arrival" data-arrival="passage"><span class="scenaro-arrival-word scenaro-loader__word">${[...'scenar'].map(letter => `<span>${letter}</span>`).join('')}</span><span class="scenaro-arrival-slot"><span class="scenaro-arrival-letter">o</span><span class="scenaro-arrival-mover"><svg viewBox="${VIEWBOX}" aria-hidden="true"><path d="${MARK_PATH}" fill="currentColor" fill-rule="evenodd"/></svg></span><i class="scenaro-arrival-shadow"></i></span></span></span>${label ? `<span class="scenaro-loader__label">${escapeHtml(label)}</span>` : '<span class="scenaro-visually-hidden">scenaro</span>'}</div>`;
}
