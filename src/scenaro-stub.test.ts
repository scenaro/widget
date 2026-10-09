import { readFileSync } from 'node:fs';
import { describe, expect, it, vi, afterEach } from 'vitest';

const source = readFileSync(new URL('../scripts/scenaro-stub.js', import.meta.url), 'utf8');
const installScenaroStub = new Function(`${source}\nreturn installScenaroStub;`)() as (root: Record<string, any>) => void;

afterEach(() => {
  vi.useRealTimers();
});

describe('installScenaroStub', () => {
  it('defines Scenaro before the release bundle and replays open once it is ready', () => {
    vi.useFakeTimers();
    const root: Record<string, any> = {};
    installScenaroStub(root);

    expect(typeof root.Scenaro.open).toBe('function');
    root.Scenaro.open({ metadata: { language: 'fr' } });

    const open = vi.fn();
    root.Scenaro = { _initialized: true, open };
    vi.advanceTimersByTime(50);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({ metadata: { language: 'fr' } });
  });

  it('leaves an existing Scenaro in place', () => {
    const existing = { open() {} };
    const root = { Scenaro: existing };
    installScenaroStub(root);
    expect(root.Scenaro).toBe(existing);
  });
});
