// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { ScenaroWidget } from './widget';
afterEach(()=>{vi.restoreAllMocks();document.body.innerHTML='';});
function setup(){
 const widget:any=Object.create(ScenaroWidget.prototype);
 const frame=document.createElement('iframe');frame.src='https://experience.example/';document.body.append(frame);
 Object.assign(widget,{iframe:frame,sessionId:1,experienceActive:false,wakeLockPending:false,wakeLockSentinel:null});
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
 const lock=Object.assign(new EventTarget(),{release:vi.fn().mockResolvedValue(undefined)});
 const request=vi.fn().mockResolvedValue(lock);
 Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request}});
 return {widget,frame,lock,request};
}
it('never requests a lock for an idle welcome and releases it after the session',async()=>{
 const {widget,frame,request,lock}=setup();await widget.acquireWakeLock();expect(request).not.toHaveBeenCalled();
 const send=(active:boolean,origin='https://experience.example')=>widget.handleMessage(new MessageEvent('message',{origin,source:frame.contentWindow,data:{type:'SCENARO_SESSION_STATE',active}}));
 send(true,'https://untrusted.example');expect(request).not.toHaveBeenCalled();
 send(true);await Promise.resolve();expect(request).toHaveBeenCalledTimes(1);
 send(false);expect(lock.release).toHaveBeenCalledOnce();
 document.dispatchEvent(new Event('visibilitychange'));expect(request).toHaveBeenCalledTimes(1);
});
it('releases an outstanding request if the session ends before it resolves',async()=>{
 const {widget,request,lock}=setup();let resolve:any;
 request.mockImplementation(()=>new Promise(r=>{resolve=r}));widget.experienceActive=true;
 const pending=widget.acquireWakeLock();widget.experienceActive=false;resolve(lock);await pending;
 expect(lock.release).toHaveBeenCalledOnce();expect(widget.wakeLockSentinel).toBeNull();
});
