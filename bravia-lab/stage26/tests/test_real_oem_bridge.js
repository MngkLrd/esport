'use strict';
/* Bench regression against owner's exact Sony original 8.931 file when present.
 * This test does not distribute OEM code or contact a TV. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const path=require('node:path');
const d=path.join('/mnt/data/bravia_stage26_private/OEM_REFERENCE_ONLY/cobalt/content/web/html5ui');
const p=path.join(d,'homeuiapi.js');
if(!fs.existsSync(p)){
 console.log('SKIP private Sony OEM homeuiapi.js not available');process.exit(0);
}
const src=fs.readFileSync(p);const digest=crypto.createHash('sha256').update(src).digest('hex');
const ops=[];
const ctx={window:{HomeuiInterface:{LaunchApp:x=>ops.push(JSON.parse(x))}},console:{log:()=>{}}};
vm.createContext(ctx);vm.runInContext(src.toString('utf8'),ctx);
assert.equal(typeof ctx.HomeUIAPI.launchApp,'function');
const native={service_name:'Netflix',service_id:1234,service_type:'Video',service_index:1,icon_url:'stock'};
ctx.HomeUIAPI.launchApp(native);
assert.equal(ops[0].service_id,1234);
assert.equal(ops[0].service_name,'Netflix');
assert.equal(ops[0].uri,'');
ctx.HomeUIAPI.launchApp('demo');
assert.ok(ops[1].uri.startsWith('https://www.google.com/search?q=demo'));
const catalog=fs.readFileSync(path.join(__dirname,'../source/bravia_catalog.js'),'utf8');
vm.runInContext(catalog,ctx);
const item=ctx.BraviaCatalog.mapServices({data:[]}).data[9];
assert.equal(ctx.BraviaCatalog.launch(item),true);
assert.equal(ops[2].uri,'https://kion.ru/');
console.log('PASS real stock Sony v8.931 HomeuiInterface native ID + web URI JSON contract, owner OEM SHA256 '+digest.slice(0,16));
