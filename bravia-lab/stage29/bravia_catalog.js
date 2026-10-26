/* Stage27: local RUTUBE client, hosted in TV firmware (not PC), Sony native HOME catalog.
 * ES5 / no external scripts / no tracking / no DRM or spoofed service IDs.
 * NOT a Sony official plugin. web navigation not proof of playback.
 */
var BraviaCatalog = (function () {
    'use strict';
    var APP_SPEC = [
        {key:'kinopoisk', label:'Кинопоиск', aliases:['Кинопоиск','Kinopoisk'], url:'https://www.kinopoisk.ru/'},
        {key:'ivi', label:'Иви', aliases:['ivi','Иви','IVI'], url:'https://www.ivi.ru/'},
        {key:'start', label:'START', aliases:['START','Start'], url:'https://start.ru/'},
        {key:'netflix', label:'Netflix', aliases:['Netflix'], url:'https://www.netflix.com/'},
        {key:'youtube', label:'YouTube', aliases:['YouTube','Youtube'], url:'https://www.youtube.com/tv'},
        {key:'rutube', label:'RUTUBE', aliases:[], url:'file:///html5ui/bravia_clients/rutube/index.html'},
        {key:'msx', label:'Media Station X', aliases:['Media Station X'], url:'https://msx.benzac.de/'},
        {key:'alcopac', label:'Al(co)pac', aliases:['Al(co)pac','Alcopac'], url:null},
        {key:'browser', label:'Браузер', aliases:['Internet Browser','Opera Browser','Browser','Интернет-браузер'], url:'https://www.google.com/'},
        {key:'kion', label:'КИОН', aliases:['КИОН','KION'], url:'https://kion.ru/'}
    ];
    var iconMap={};
    function setIconMap(icons){iconMap=(icons && typeof icons==='object')?icons:{};}
    function normalize(s){ return (typeof s==='string'?s:'').replace(/^\s+|\s+$/g,'').toLowerCase(); }
    function foundExactly(spec, native){
        var i,j,hits=[];
        for(i=0;i<native.length;i++){
            if(!native[i]||typeof native[i].service_name!=='string')continue;
            for(j=0;j<spec.aliases.length;j++){
                if(normalize(native[i].service_name)===normalize(spec.aliases[j])){
                    if(native[i].service_id!==undefined && native[i].service_id!==null &&
                       native[i].service_id!=='' && native[i].service_type!==undefined){hits.push(native[i]);}
                    break;
                }
            }
        }
        return hits.length===1?hits[0]:null;
    }
    function mapServices(nativeList){
        var list=nativeList && Object.prototype.toString.call(nativeList.data)==="[object Array]" ? nativeList.data : [];
        var data=[],i,s,match;
        for(i=0;i<APP_SPEC.length;i++){
            s=APP_SPEC[i];match=foundExactly(s,list);
            data.push({
                service_name:s.label, service_id:match?match.service_id:null,
                service_type:'Video', service_index:i,
                icon_url:iconMap[s.key] || 'bravia_assets/'+s.key+'.png',
                _braviaKind:match?'native':s.url?'web':'pending',
                _braviaNative:match,
                _braviaURL:match?null:s.url,
                _braviaKey:s.key
            });
        }
        return {data:data};
    }
    function canOpen(url){
        var i;
        for(i=0;i<APP_SPEC.length;i++)if(APP_SPEC[i].url===url)return true;
        return false;
    }
    function notify(text){
        if(typeof document==='undefined')return;
        var elem=document.getElementById('toastMessage');
        if(elem){elem.textContent=text;elem.style.display='block';}
    }
    function launch(item){
        if(!item || !item._braviaKind)return false;
        if(item._braviaKind==='native' && item._braviaNative &&
           typeof HomeUIAPI!=='undefined' && typeof HomeUIAPI.launchApp==='function'){
            /* Caller must pass the UNALTERED record from real Sony BIVL. */
            HomeUIAPI.launchApp(item._braviaNative);
            return true;
        }
        if(item._braviaKind==='web' && canOpen(item._braviaURL)){
            if(typeof window!=='undefined' && window.HomeuiInterface &&
               typeof window.HomeuiInterface.LaunchApp==='function'){
                /* Same {uri:...} route used by OEM homeuiapi.js for web search. */
                window.HomeuiInterface.LaunchApp(JSON.stringify({uri:item._braviaURL}));
                return true;
            }
            notify('Встроенный браузер Sony недоступен');
            return false;
        }
        notify('Для '+item.service_name+' ещё нет совместимого клиента');
        return false;
    }
    function names(){var result=[],i;for(i=0;i<APP_SPEC.length;i++)result.push(APP_SPEC[i].label);return result;}
    return {mapServices:mapServices,launch:launch,names:names,setIconMap:setIconMap};
}());
