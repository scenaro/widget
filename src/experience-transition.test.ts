// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenIframeReady, revealExperience } from './experience-transition';
afterEach(()=>{vi.useRealTimers();document.body.innerHTML='';});
describe('experience handoff',()=>{
 it('remembers an early ready event and checks the sending frame and origin',async()=>{
  vi.useFakeTimers();const frame=document.createElement('iframe');frame.src='https://shop.example/';document.body.append(frame);
  const promise=whenIframeReady(frame);let resolved=false;promise.then(()=>resolved=true);
  window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,origin:'https://wrong.example',data:{type:'SCENARO_VIEW_READY'}}));await Promise.resolve();expect(resolved).toBe(false);
  window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,origin:'https://shop.example',data:{type:'SCENARO_VIEW_READY'}}));await promise;
  expect(whenIframeReady(frame)).toBe(promise);expect(resolved).toBe(true);expect(vi.getTimerCount()).toBe(0);
 });
 it('falls back for older experiences and signals presentation to the exact origin',async()=>{
  vi.useFakeTimers();const frame=document.createElement('iframe');frame.src='https://shop.example/';document.body.append(frame);
  const promise=whenIframeReady(frame);frame.dispatchEvent(new Event('load'));await vi.advanceTimersByTimeAsync(800);await promise;
  const send=vi.spyOn(frame.contentWindow!,'postMessage').mockImplementation(()=>{});revealExperience(frame);
  expect(frame.style.opacity).toBe('1');expect(send).toHaveBeenCalledWith({type:'SCENARO_PRESENT'},'https://shop.example');expect(vi.getTimerCount()).toBe(0);
 });
});
