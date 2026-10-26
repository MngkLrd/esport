/* Reversible in-RAM attachment to the EXISTING factory Sony HTML5UI.
 * Apply only to the exact factory HOME JavaScript context (debugger test).
 * No firmware writes, no side-channel, no timers, no installed new DRM apps.
 */
(function(){
  'use strict';
  if(typeof BraviaCatalog==='undefined' || typeof HomeUIAPI==='undefined' ||
     typeof AllAppsModule==='undefined' || typeof updateHomeUIAPICache!=='function')
    return 'BRAVIA_WRONG_CONTEXT';
  if(window.__braviaRamUndo) return 'BRAVIA_ALREADY_PATCHED';
  var originalList=HomeUIAPI.bivlservicelist;
  var originalLaunch=HomeUIAPI.launchApp;
  if(typeof originalList!=='function'||typeof originalLaunch!=='function')return 'BRAVIA_API_MISSING';
  window.__braviaRamUndo=function(){
    HomeUIAPI.bivlservicelist=originalList;
    HomeUIAPI.launchApp=originalLaunch;
    currentBivlList=originalList();
    if(typeof AllAppsModule.getMenu==='function')AllAppsModule.getMenu();
    window.__braviaRamUndo=null;
    return 'BRAVIA_REVERTED';
  };
  HomeUIAPI.bivlservicelist=function(){
    var list;
    try{list=JSON.parse(originalList());}catch(e){list={data:[]};}
    return JSON.stringify(BraviaCatalog.mapServices(list));
  };
  HomeUIAPI.launchApp=function(item){
    if(item && item._braviaKind){
      if(item._braviaKind==='native'&&item._braviaNative){
        return originalLaunch(item._braviaNative);
      }
      return BraviaCatalog.launch(item);
    }
    return originalLaunch(item);
  };
  currentBivlList=HomeUIAPI.bivlservicelist();
  if(typeof AllAppsModule.getMenu==='function')AllAppsModule.getMenu();
  return 'BRAVIA_RAM_CATALOG_ACTIVE';
}());
