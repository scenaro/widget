import { describe, expect, it } from 'vitest';
import { apiOrigin, embedOrigin, experienceUrl } from './embed-origin';

describe('embedOrigin', () => {
  it('uses the staging embed host for a staging CDN script', () => {
    expect(embedOrigin('https://cdn.staging.scenaro.io/releases/2026-10-12-175500/widget.js'))
      .toBe('https://embed.staging.scenaro.io');
  });

  it('uses the production embed host otherwise', () => {
    expect(embedOrigin('https://cdn.scenaro.io/widget.js')).toBe('https://embed.scenaro.io');
    expect(embedOrigin(undefined)).toBe('https://embed.scenaro.io');
  });
});

describe('apiOrigin', () => {
  it('follows the script host', () => {
    expect(apiOrigin('https://cdn.staging.scenaro.io/widget.js')).toBe('https://api.staging.scenaro.io');
    expect(apiOrigin('https://cdn.scenaro.io/widget.js')).toBe('https://api.scenaro.io');
    expect(apiOrigin(undefined)).toBe('https://api.scenaro.io');
  });
});

describe('experienceUrl', () => {
  it('keeps the stored query and marks the handoff', () => {
    expect(experienceUrl('https://cdn.staging.scenaro.io/commerce/index.html?cart=%2Fcart', 'pub-1', 'fr'))
      .toBe('https://cdn.staging.scenaro.io/commerce/index.html?cart=%2Fcart&scenario=pub-1&language=fr&scenaroTransition=1');
  });
});
