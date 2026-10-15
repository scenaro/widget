import { afterEach, describe, expect, it, vi } from 'vitest';
import { experienceLocation, locateExperience } from './experience-location';

afterEach(() => vi.unstubAllGlobals());

describe('experience location', () => {
  it('pins the final published URL and stays on the staging API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ configuration: { iframe_url: 'https://experience.example/shop?cart=%2Fcart' } }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await locateExperience('pub-1', 'https://cdn.staging.scenaro.io/widget.js', undefined, 'fr'))
      .toBe('https://experience.example/shop?cart=%2Fcart&scenario=pub-1&language=fr&scenaroTransition=1');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.staging.scenaro.io/v1/public/publications/pub-1');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit');
  });
  it('keeps explicit shop overrides without a lookup', async () => {
    const fetchMock = vi.fn();vi.stubGlobal('fetch', fetchMock);
    expect(await locateExperience('pub-2', undefined, 'https://experience.example/custom'))
      .toBe('https://experience.example/custom?scenario=pub-2&scenaroTransition=1');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not fall back across environments or learn an origin from a message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });vi.stubGlobal('fetch', fetchMock);
    await expect(locateExperience('missing', 'https://cdn.staging.scenaro.io/widget.js')).rejects.toThrow('404');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(['javascript:alert(1)', 'data:text/html,hello', 'https://user:pass@experience.example'])('rejects an unsafe address: %s', address => {
    expect(() => experienceLocation(address, 'pub-1')).toThrow();
  });
});
