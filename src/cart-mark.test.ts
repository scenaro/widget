// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { ScenaroWidget } from './widget';

it('stamps the cart once when the session reports a conversation', async () => {
  const widget: any = Object.create(ScenaroWidget.prototype);
  const frame = document.createElement('iframe');
  frame.src = 'https://experience.example/';
  document.body.append(frame);
  const markConversation = vi.fn().mockResolvedValue(undefined);
  Object.assign(widget, {
    iframe: frame,
    publicationId: 'pub-1',
    stampedConversation: '',
    experienceActive: false,
    wakeLockPending: false,
    wakeLockSentinel: null,
    engine: { markConversation },
    acquireWakeLock: () => Promise.resolve(),
    startWakeLockVisibilityReacquire: () => {},
    stopWakeLockVisibilityReacquire: () => {},
    releaseWakeLock: () => {},
  });
  const send = (data: Record<string, unknown>) => widget.handleMessage(new MessageEvent('message', {
    origin: 'https://experience.example',
    source: frame.contentWindow,
    data: { type: 'SCENARO_SESSION_STATE', active: true, ...data },
  }));
  send({ conversationId: 'conv-1', userId: 7 });
  send({ conversationId: 'conv-1', userId: 7 });
  await Promise.resolve();
  await Promise.resolve();
  expect(markConversation).toHaveBeenCalledOnce();
  expect(markConversation).toHaveBeenCalledWith({
    userId: '7',
    conversationId: 'conv-1',
    publicationId: 'pub-1',
  });
});
