import { describe, expect, it } from 'vitest';
import { assistantCopy } from './chooser';

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
