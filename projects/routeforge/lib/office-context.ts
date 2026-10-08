import { AsyncLocalStorage } from "node:async_hooks";
const background=new AsyncLocalStorage<Pick<ExecutionContext,"waitUntil">>();
export function runWithOfficeContext<T>(ctx:Pick<ExecutionContext,"waitUntil">,fn:()=>T){return background.run(ctx,fn);}
export function deferOffice(fn:()=>Promise<unknown>){const ctx=background.getStore();if(ctx)ctx.waitUntil(fn().catch(()=>{console.error("Deferred office task will retry on polling");}));}
