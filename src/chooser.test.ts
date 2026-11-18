import { describe, expect, it, vi, beforeEach } from 'vitest';
// @vitest-environment jsdom
import { assistantCopy, buildChooser, buildDockChoices } from './chooser';

describe('assistantCopy', () => {
  it('uses the French defaults when the script has no labels', () => {
    expect(assistantCopy({}, '')).toEqual({
      name: 'Conseiller',
      role: 'Disponible',
      chatLabel: 'Par écrit',
      immersiveLabel: 'En immersion',
      waiting: 'Le chat écrit arrive bientôt.',
    });
  });

  it('prefers the attributes, then the floating label', () => {
    expect(assistantCopy({
      assistantName: ' Louis ',
      assistantRole: 'Assistant caviste',
      chatLabel: 'Écrire',
      immersiveLabel: 'Entrer',
    }, 'Conseiller').name).toBe('Louis');
    expect(assistantCopy({}, '  Louis  ').name).toBe('Louis');
  });
});

// A disabled written-chat entry blocked the Shopify storefront review.
describe('available conversation entry points', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  });
  it.each(['dock', 'popup', 'sheet'] as const)('offers a working immersive entry in the %s launcher', (variant) => {
    const copy = assistantCopy({}, '');
    const menu = variant === 'dock' ? buildDockChoices(copy) : buildChooser(copy, variant);
    expect(menu.querySelector('[data-scenaro-choice="chat"]')).toBeNull();
    const entry = menu.querySelector<HTMLButtonElement>('[data-scenaro-choice="immersive"]');
    expect(entry).not.toBeNull();
    expect(entry?.disabled).toBe(false);
  });
});
