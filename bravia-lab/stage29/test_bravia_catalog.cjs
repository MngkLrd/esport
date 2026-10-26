'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const text=fs.readFileSync(path.join(root,'stage29/bravia_catalog.js'),'utf8');
let called=[];
const sandbox={
  window:{HomeuiInterface:{LaunchApp(payload){called.push(['URI',JSON.parse(payload)]);return true;}}},
  HomeUIAPI:{launchApp(app){called.push(['NATIVE',app]);return true;}},
  document:{getElementById(){return {textContent:'',style:{display:'none'}};}}
};
vm.createContext(sandbox);
vm.runInContext(text,sandbox,{filename:'bravia_catalog.js'});
const catalog=sandbox.BraviaCatalog;
function plain(x){return JSON.parse(JSON.stringify(x));}
const zero=plain(catalog.mapServices({data:[]}));
assert.equal(zero.data.length,10);
assert.deepEqual(zero.data.map(x=>x.service_name),
 ['Кинопоиск','Иви','START','Netflix','YouTube','RUTUBE','Media Station X','Al(co)pac','Браузер','КИОН']);
assert.equal(zero.data[3].service_id,null);
assert.equal(zero.data[3]._braviaKind,'web');
assert.equal(zero.data[7]._braviaKind,'pending');
assert.equal(zero.data[5]._braviaURL,'file:///html5ui/bravia_clients/rutube/index.html');
assert.equal(catalog.launch(zero.data[5]),true);
assert.deepEqual(called.pop(),['URI',{uri:'file:///html5ui/bravia_clients/rutube/index.html'}]);
assert.equal(catalog.launch(zero.data[7]),false);
assert.equal(called.length,0);
const reg=plain(catalog.mapServices({data:[
 {service_name:'Netflix',service_id:31,service_type:'Video',service_index:1,uri:''},
 {service_name:'YouTube Kids',service_id:32,service_type:'Video',service_index:2,uri:''},
 {service_name:'YouTube',service_id:33,service_type:'Video',service_index:3,uri:''}
]}));
assert.equal(reg.data[3]._braviaKind,'native');
assert.equal(reg.data[4].service_id,33);
assert.equal(catalog.launch(reg.data[3]),true);
assert.deepEqual(called.pop(),['NATIVE', {service_name:'Netflix',service_id:31,service_type:'Video',service_index:1,uri:''}]);
assert.equal(catalog.launch(reg.data[4]),true);
assert.equal(called.pop()[1].service_id,33);
const duplicate=plain(catalog.mapServices({data:[
 {service_name:'Netflix',service_id:31,service_type:'Video'},
 {service_name:'Netflix',service_id:31,service_type:'Video'}
]}));
assert.equal(duplicate.data[3]._braviaKind,'web');
assert.equal(catalog.launch({service_name:'Random',_braviaKind:'web',_braviaURL:'http://evil.example'}),false);
const version=fs.readFileSync(path.join(root,'stage29/patch_verified_oem.py'),'utf8');
assert.match(version,/PIN\s*=\s*\{/);
console.log('PASS Stage29 real Sony BIVL: ten tiles, local client, exact matching, duplicate guard, fail closed');
