// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenIframeReady, revealExperience, showExperience, requestedCloseVisibility } from './experience-transition';
afterEach(()=>{vi.useRealTimers();document.body.innerHTML='';});
describe('experience handoff',()=>{
 it('remembers an early ready event and checks the sending frame and origin',async()=>{
  vi.useFakeTimers();const frame=document.createElement('iframe');frame.src='https://shop.example/';document.body.append(frame);
  const promise=whenIframeReady(frame);let resolved=false;promise.then(()=>resolved=true);
  window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,origin:'https://wrong.example',data:{type:'SCENARO_VIEW_READY'}}));await Promise.resolve();expect(resolved).toBe(false);
  window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,origin:'https://shop.example',data:{type:'SCENARO_VIEW_READY'}}));await promise;
  expect(whenIframeReady(frame)).toBe(promise);expect(resolved).toBe(true);expect(vi.getTimerCount()).toBe(0);
 });
 it('waits for the experience signal instead of the document load',async()=>{
  vi.useFakeTimers();const frame=document.createElement('iframe');frame.src='https://shop.example/';document.body.append(frame);
  const promise=whenIframeReady(frame);let resolved=false;promise.then(()=>{resolved=true;});
  frame.dispatchEvent(new Event('load'));await vi.advanceTimersByTimeAsync(800);expect(resolved).toBe(false);
  window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,origin:'https://shop.example',data:{type:'SCENARO_VIEW_READY'}}));await promise;
  const send=vi.spyOn(frame.contentWindow!,'postMessage').mockImplementation(()=>{});revealExperience(frame);
  expect(frame.style.opacity).toBe('1');expect(send).toHaveBeenCalledWith({type:'SCENARO_PRESENT'},'https://shop.example');expect(vi.getTimerCount()).toBe(0);
 });
});

it('keeps the experience opaque beneath the fading cover',()=>{
 const frame=document.createElement('iframe');frame.style.opacity='0';frame.style.transition='opacity 300ms';showExperience(frame);
 expect(frame.style.opacity).toBe('1');expect(frame.style.transition).toBe('none');expect(frame.style.background).toBe('rgb(255, 255, 255)');
});
it('validates the close-control sender, origin and boolean value',()=>{
 const frame=document.createElement('iframe');frame.src='https://experience.example/';document.body.append(frame);
 const event=(origin:string,visible:unknown,source:Window|null=frame.contentWindow)=>new MessageEvent('message',{origin,source,data:{type:'SCENARO_CLOSE_VISIBILITY',visible}});
 expect(requestedCloseVisibility(event('https://experience.example',false),frame)).toBe(false);
 expect(requestedCloseVisibility(event('https://experience.example',true),frame)).toBe(true);
 expect(requestedCloseVisibility(event('https://other.example',false),frame)).toBe(null);
 expect(requestedCloseVisibility(event('https://experience.example',false,window),frame)).toBe(null);
 expect(requestedCloseVisibility(event('https://experience.example','false'),frame)).toBe(null);
});
