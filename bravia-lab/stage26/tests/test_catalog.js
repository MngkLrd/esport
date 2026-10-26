'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const dir=path.join(__dirname,'..','source');
const src=fs.readFileSync(path.join(dir,'bravia_catalog.js'),'utf8');
function sandbox(){
 const calls=[],ctx={JSON, document:{getElementById:()=>({style:{},textContent:''})},
 window:{HomeuiInterface:{LaunchApp:(s)=>calls.push(['web',JSON.parse(s)])}},
 HomeUIAPI:{launchApp:(o)=>calls.push(['native',o])}}
 vm.createContext(ctx);vm.runInContext(src,ctx);return {ctx,calls};
}
function test(name,fn){try{fn();console.log('PASS '+name)}catch(e){console.error('FAIL '+name);throw e}}
test('ten exact user apps in order',()=>{
 const {ctx}=sandbox(); assert.deepEqual([...ctx.BraviaCatalog.names()],
 ['Кинопоиск','Иви','START','Netflix','YouTube','RUTUBE','Media Station X','Al(co)pac','Браузер','КИОН']);
});
test('empty Sony BIVL creates ten user entries without fake native IDs',()=>{
 const {ctx}=sandbox();const a=ctx.BraviaCatalog.mapServices({data:[]}).data;
 assert.equal(a.length,10);assert.equal(a[9].service_id,null);
 assert.equal(a[9]._braviaKind,'web');assert.equal(a[7]._braviaKind,'pending');
});
test('native app launches untouched real BIVL object',()=>{
 const {ctx,calls}=sandbox(),netflix={service_name:'Netflix',service_id:204,service_index:12,service_type:'Video',icon_url:'stock'};
 const a=ctx.BraviaCatalog.mapServices({data:[netflix]}).data[3];
 assert.equal(a._braviaKind,'native');assert.equal(a.service_id,204);
 assert.equal(ctx.BraviaCatalog.launch(a),true);assert.equal(calls[0][0],'native');assert.equal(calls[0][1],netflix);
});
test('substring name cannot impersonate YouTube',()=>{
 const {ctx}=sandbox();const a=ctx.BraviaCatalog.mapServices({data:[{service_name:'YouTube Kids',service_id:6,service_type:'Video'}]}).data[4];
 assert.equal(a._braviaKind,'web');assert.equal(a.service_id,null);
});
test('duplicate native identity fails closed to provider web entry',()=>{
 const {ctx}=sandbox();const a=ctx.BraviaCatalog.mapServices({data:[
 {service_name:'Netflix',service_id:1,service_type:'Video'},
 {service_name:'NETFLIX',service_id:2,service_type:'Video'}]}).data[3];
 assert.equal(a._braviaKind,'web');
});
test('native record missing Sony ID cannot be launched',()=>{
 const {ctx}=sandbox();const a=ctx.BraviaCatalog.mapServices({data:[{service_name:'КИОН',service_type:'Video'}]}).data[9];
 assert.equal(a._braviaKind,'web');
});
test('web fallbacks pass canonical verified https URIs',()=>{
 const {ctx,calls}=sandbox();const a=ctx.BraviaCatalog.mapServices({data:[]}).data;
 assert.equal(ctx.BraviaCatalog.launch(a[9]),true);
 assert.equal(calls[0][0],'web');assert.deepEqual(calls[0][1],{uri:'https://kion.ru/'});
});
test('never launch attacker-supplied URL',()=>{
 const {ctx,calls}=sandbox();const a=ctx.BraviaCatalog.mapServices({data:[]}).data[9];
 a._braviaURL='https://attacker.invalid/';assert.equal(ctx.BraviaCatalog.launch(a),false);
 assert.equal(calls.length,0);
});
test('Al(co)pac has no imaginary executable',()=>{
 const {ctx,calls}=sandbox();const a=ctx.BraviaCatalog.mapServices({data:[]}).data[7];
 assert.equal(ctx.BraviaCatalog.launch(a),false);assert.equal(calls.length,0);
});
test('native registry non-array is rejected',()=>{
 const {ctx}=sandbox();assert.equal(ctx.BraviaCatalog.mapServices({data:{}}).data.length,10);
});
test('no Sony interface means no fake web success',()=>{
 const {ctx}=sandbox();delete ctx.window.HomeuiInterface;
 assert.equal(ctx.BraviaCatalog.launch(ctx.BraviaCatalog.mapServices({data:[]}).data[0]),false);
});
test('RAM hook is reversible and preserves native dispatch',()=>{
 const {ctx,calls}=sandbox();const original={data:[{service_name:'Netflix',service_id:9,service_type:'Video'}]};
 const baselineList=()=>JSON.stringify(original);
 const baselineLaunch=x=>calls.push(['baseline',x]);
 ctx.HomeUIAPI.bivlservicelist=baselineList;ctx.HomeUIAPI.launchApp=baselineLaunch;
 ctx.AllAppsModule={getMenu:()=>++ctx.redraw};ctx.redraw=0;
 ctx.updateHomeUIAPICache=()=>{};ctx.currentBivlList=baselineList();
 const hook=fs.readFileSync(path.join(dir,'ram_hook.js'),'utf8');
 assert.equal(vm.runInContext(hook,ctx),'BRAVIA_RAM_CATALOG_ACTIVE');
 const list=JSON.parse(ctx.HomeUIAPI.bivlservicelist());assert.equal(list.data.length,10);
 ctx.HomeUIAPI.launchApp(list.data[3]);assert.equal(calls[0][0],'baseline');assert.equal(calls[0][1].service_id,9);
 assert.equal(ctx.window.__braviaRamUndo(),'BRAVIA_REVERTED');
 assert.equal(ctx.HomeUIAPI.launchApp,baselineLaunch);assert.equal(ctx.HomeUIAPI.bivlservicelist,baselineList);
 assert.equal(ctx.currentBivlList,JSON.stringify(original));
});
test('RAM hook refuses wrong context',()=>{
 const {ctx}=sandbox();const hook=fs.readFileSync(path.join(dir,'ram_hook.js'),'utf8');
 assert.equal(vm.runInContext(hook,ctx),'BRAVIA_WRONG_CONTEXT');
});
test('no tracking and no telemetry in authored launcher catalog',()=>{
 for(const forbidden of [/fetch\s*\(/,/XMLHttpRequest/,/mixpanel/i,/analytics/i,/sendBeacon/,/eval\s*\(/])
 assert.equal(forbidden.test(src),false,String(forbidden));
});
console.log('PASS 14/14 catalog compatibility cases');
