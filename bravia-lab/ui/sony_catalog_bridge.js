/*
 * BRAVIA HOME: research-only Cobalt BIVL catalog bridge (ES5).
 * Verified contract in Sony v8.931 HTML5 HOME:
 *   HomeuiInterface.bivlservicelist -> JSON {data:[...]}
 *   HomeuiInterface.LaunchApp(JSON.stringify(registeredService))
 * This file cannot install apps, replace Sony HOME, or bypass DRM/signatures.
 */
(function(root){
'use strict';
var ALIASES={
 kinopoisk:['Кинопоиск','Kinopoisk'],
 ivi:['Иви','ivi'],
 start:['START'],
 netflix:['Netflix'],
 youtube:['YouTube'],
 rutube:['RUTUBE'],
 mediax:['Media Station X','MSX'],
 alpac:['Al(co)pac','Alcopa'],
 browser:['Opera Browser','Internet Browser','Opera','Браузер'],
 kion:['КИОН','KION']
};
var LIMIT=131072,MAX_ITEMS=256;
function nameKey(value){
 return typeof value==='string'?value.replace(/^\s+|\s+$/g,'').toLowerCase():'';
}
function valid(item){
 return !!(item&&typeof item==='object'&&!Array.isArray(item)&&
 typeof item.service_name==='string'&&item.service_name.length<128&&
 typeof item.service_id==='number'&&isFinite(item.service_id)&&
 Math.floor(item.service_id)===item.service_id&&item.service_id>=0&&
 typeof item.service_type==='string'&&item.service_type.length<64&&
 typeof item.service_index==='number'&&isFinite(item.service_index)&&
 typeof item.icon_url==='string'&&item.icon_url.length<2048);
}
function parseCatalog(raw){
 if(typeof raw!=='string'||raw.length>LIMIT)return [];
 try{
  var doc=JSON.parse(raw);
  if(!doc||!Array.isArray(doc.data)||doc.data.length>MAX_ITEMS)return [];
  var out=[];
  for(var i=0;i<doc.data.length;i++)if(valid(doc.data[i]))out.push(doc.data[i]);
  return out;
 }catch(_e){return [];}
}
function lookup(id,items){
 if(!Object.prototype.hasOwnProperty.call(ALIASES,id))return null;
 var names=ALIASES[id],seen=[];
 for(var i=0;i<items.length;i++){
  var key=nameKey(items[i].service_name);
  for(var j=0;j<names.length;j++)if(key===nameKey(names[j])){seen.push(items[i]);break;}
 }
 // Ambiguities must be resolved from an actual live TV catalog, never guessed.
 return seen.length===1?seen[0]:null;
}
function liveAPI(){
 var home=root&&root.HomeuiInterface;
 return home&&typeof home.LaunchApp==='function'&&
        typeof home.bivlservicelist==='string'?home:null;
}
function available(id){
 var api=liveAPI();
 return !!(api&&lookup(id,parseCatalog(api.bivlservicelist)));
}
function launchIfRegistered(id){
 var api=liveAPI();
 if(!api)return false;
 var registered=lookup(id,parseCatalog(api.bivlservicelist));
 if(!registered)return false;
 // Sony's stock HomeUIAPI.launchApp() builds this exact metadata shape,
 // excluding externally supplied URI. Preserve the actual registered ID.
 var payload={
  icon_url:registered.icon_url,
  service_name:registered.service_name,
  service_id:registered.service_id,
  service_type:registered.service_type,
  service_index:registered.service_index,
  uri:''
 };
 try{
  api.LaunchApp(JSON.stringify(payload));
  return true; // Dispatch success only; actual playback not verified.
 }catch(_e){return false;}
}
var exported={parseCatalog:parseCatalog,lookup:lookup,available:available,
 launchIfRegistered:launchIfRegistered};
root.BraviaCatalogBridge=exported;
if(typeof module!=='undefined'&&module.exports)module.exports=exported;
}(typeof window!=='undefined'?window:(typeof global!=='undefined'?global:this)));
