/* Sony BRAVIA HOME v2 — off-device TV-first launcher prototype (ES5). */
(function(root){
'use strict';
var ACTIONS=['tv','channels','inputs','settings'];
var COLUMNS=5;
var RESERVED={POWER:1,VOLUMEUP:1,VOLUMEDOWN:1,MUTE:1,CHANNELUP:1,CHANNELDOWN:1,GUIDE:1,SOURCE:1,SETTINGS:1,OPTIONS:1,MENU:1,INPUT:1,PICTURE:1,AUDIO:1};
function createModel(apps){
  if(!apps||!apps.length)throw new Error('Missing application catalog');
  return{screen:'tv',area:'tvcard',focus:0,selected:null,apps:apps,notice:'',nativeIntent:null,nativeAppIntent:null};
}
function normalizeKey(e){
  var k=e.key||'',code=e.keyCode||e.which||0;
  if(k==='ArrowLeft'||k==='Left'||code===37)return'LEFT';
  if(k==='ArrowRight'||k==='Right'||code===39)return'RIGHT';
  if(k==='ArrowUp'||k==='Up'||code===38)return'UP';
  if(k==='ArrowDown'||k==='Down'||code===40)return'DOWN';
  if(k==='Enter'||k==='OK'||k==='Select'||code===13)return'OK';
  if(k==='Escape'||k==='Backspace'||k==='BrowserBack'||k==='GoBack'||code===8||code===27||code===461)return'BACK';
  if(k==='Home'||k==='F1'||k==='h'||k==='H'||code===36||code===112)return'HOME';
  if(k==='t'||k==='T')return'TV';
  if(k==='AudioVolumeUp')return'VOLUMEUP';
  if(k==='AudioVolumeDown')return'VOLUMEDOWN';
  if(k==='AudioVolumeMute')return'MUTE';
  if(k==='ChannelUp')return'CHANNELUP';
  if(k==='ChannelDown')return'CHANNELDOWN';
  if(k==='Guide')return'GUIDE';
  if(k==='Source')return'SOURCE';
  if(k==='Settings'||k==='SettingsMenu')return'SETTINGS';
  if(k==='Options'||k==='ContextMenu')return'OPTIONS';
  if(k==='Menu')return'MENU';
  if(k==='Input')return'INPUT';
  return k?k.toUpperCase():'';
}
function transition(s,key){
  if(RESERVED[key])return s;
  var n={screen:s.screen,area:s.area,focus:s.focus,selected:s.selected,apps:s.apps,notice:s.notice,nativeIntent:null,nativeAppIntent:null};
  if(key==='TV'){n.screen='tv';n.selected=null;n.notice='';return n;}
  if(key==='HOME'){
    if(s.screen==='tv'){n.area='tvcard';n.focus=0;}
    n.screen='home';n.selected=null;n.notice='';return n;
  }
  if(key==='BACK'){
    if(s.screen==='detail'){n.screen='home';n.selected=null;}
    else if(s.screen==='home'){n.screen='tv';}
    return n;
  }
  if(s.screen!=='home')return s;
  if(key==='LEFT'){
    if(s.area==='app'&&s.focus%COLUMNS>0)n.focus=s.focus-1;
    if(s.area==='action')n.focus=Math.max(0,s.focus-1);
  }else if(key==='RIGHT'){
    if(s.area==='app'&&s.focus%COLUMNS<COLUMNS-1&&s.focus+1<s.apps.length)n.focus=s.focus+1;
    if(s.area==='action')n.focus=Math.min(ACTIONS.length-1,s.focus+1);
  }else if(key==='UP'){
    if(s.area==='app'){
      if(s.focus<COLUMNS){n.area='tvcard';n.focus=0;}
      else n.focus=s.focus-COLUMNS;
    }else if(s.area==='action'){
      n.area='app';n.focus=Math.min(COLUMNS+s.focus,s.apps.length-1);
    }
  }else if(key==='DOWN'){
    if(s.area==='tvcard'){n.area='app';n.focus=0;}
    else if(s.area==='app'){
      if(s.focus<COLUMNS){n.focus=Math.min(s.focus+COLUMNS,s.apps.length-1);}
      else{n.area='action';n.focus=Math.min(s.focus-COLUMNS,ACTIONS.length-1);}
    }
  }else if(key==='OK'){
    if(s.area==='tvcard'){n.screen='tv';}
    else if(s.area==='action'){
      if(s.focus===0)n.screen='tv';
      else{
        /* A nativeIntent is a request to the future Sony-specific adapter, not an HTML replacement for a system menu. */
        n.nativeIntent=ACTIONS[s.focus];
        n.screen='detail';n.selected=null;
        n.notice=s.focus===1?'Список телеканалов и GUIDE будут открываться штатными службами Sony после интеграции.':s.focus===2?'Выбор HDMI/USB откроется через оригинальный интерфейс Sony после интеграции.':'Оригинальные системные настройки Sony останутся доступны после интеграции.';
      }
    }else{
      n.screen='detail';n.selected=s.apps[s.focus].id;n.nativeAppIntent=n.selected;
      n.notice=s.apps[s.focus].id==='alpac'?'Al(co)pac — серверная платформа. Клиентский запуск на Sony Linux ещё не подтверждён.':s.apps[s.focus].id==='mediax'?'Media Station X (MSX): совместимость с Vewd телевизора необходимо проверить.':'Значок подготовлен. Приложение ещё не интегрировано в прошивку Sony.';
    }
  }
  return n;
}
function attachDocument(doc,apps){
  var state=createModel(apps),tv=doc.getElementById('tv-view'),home=doc.getElementById('home-view'),detail=doc.getElementById('detail-view');
  var tiles=doc.getElementById('app-tiles'),actions=doc.querySelectorAll('.quick-action'),hero=doc.getElementById('tv-card');
  var title=doc.getElementById('detail-title'),message=doc.getElementById('detail-message');
  function text(n,v){n.textContent=v;}
  function child(parent,type,cl,value){var n=doc.createElement(type);n.className=cl;if(value!==undefined)text(n,value);parent.appendChild(n);return n;}
  for(var i=0;i<apps.length;i++){
    var a=apps[i],b=doc.createElement('button');b.type='button';b.className='app-tile tile-'+a.tone;
    b.setAttribute('data-id',a.id);b.setAttribute('aria-label',a.name+' — '+a.mode);
    child(b,'span','tile-glow');
    child(b,'span','tile-identity logo-'+a.logo,a.short);
    child(b,'span','tile-name',a.name);
    (function(index){b.onclick=function(){state.area='app';state.focus=index;advance('OK');};}(i));
    tiles.appendChild(b);
  }
  for(var k=0;k<actions.length;k++){
    (function(index){actions[index].onclick=function(){state.area='action';state.focus=index;advance('OK');};}(k));
  }
  function mark(el,on){
    el.className=el.className.replace(/\s+is-focused/g,'')+(on?' is-focused':'');
    el.setAttribute('aria-selected',on?'true':'false');el.setAttribute('tabindex',on?'0':'-1');
  }
  /* BraviaNativeBridge is an integration contract WE define, not an existing Sony browser API. */
  /* A production build MUST provide an adapter that opens the real Sony settings, */
  /* EPG/channel list and input selector. If absent, show only prototype notice. */
  function advance(key){
    state=transition(state,key);
    if(state.nativeAppIntent){
      var chosen=state.nativeAppIntent,catalog=root.BraviaCatalogBridge,launched=false;
      if(catalog&&typeof catalog.launchIfRegistered==='function'){
        try{launched=catalog.launchIfRegistered(chosen)===true;}catch(_error){launched=false;}
      }
      state.nativeAppIntent=null;
      if(launched){
        // Sony owns focus after launching the registered native app.
        state.screen='home';state.notice='';state.selected=null;
        return;
      }
    }
    if(state.nativeIntent){
      var intent=state.nativeIntent,bridge=root.BraviaNativeBridge,accepted=false;
      if(bridge&&typeof bridge.openNative==='function'){
        try{accepted=bridge.openNative(intent)===true;}catch(_err){accepted=false;}
      }
      state.nativeIntent=null;
      if(accepted){
        // Sony owns native overlay and focus. Never call render() immediately
        // after a successful native handoff: rendering would reclaim focus.
        state.screen='home';state.notice='';state.selected=null;
        return;
      }
    }
    render();
  }
  function render(){
    tv.hidden=state.screen!=='tv';home.hidden=state.screen!=='home';detail.hidden=state.screen!=='detail';
    var bs=tiles.children;
    for(var j=0;j<bs.length;j++)mark(bs[j],state.screen==='home'&&state.area==='app'&&state.focus===j);
    for(var h=0;h<actions.length;h++)mark(actions[h],state.screen==='home'&&state.area==='action'&&state.focus===h);
    mark(hero,state.screen==='home'&&state.area==='tvcard');
    if(state.screen==='detail'){
      var item=null;
      for(var m=0;m<apps.length;m++)if(apps[m].id===state.selected)item=apps[m];
      text(title,item?item.name:state.notice.indexOf('каналов')>=0?'Каналы':state.notice.indexOf('HDMI')>=0?'Источники':'Настройки');
      text(message,state.notice);
    }
    if(state.screen==='home'){
      var active=state.area==='tvcard'?hero:state.area==='app'?bs[state.focus]:actions[state.focus];
      if(active&&doc.activeElement!==active)active.focus();
    }else if(state.screen==='detail'){doc.getElementById('detail-back').focus();}
    else{doc.getElementById('open-home').focus();}
    doc.body.setAttribute('data-screen',state.screen);
    doc.body.setAttribute('data-focus',state.area+':'+state.focus);
  }
  doc.addEventListener('keydown',function(e){
    var key=normalizeKey(e);
    if(/^(LEFT|RIGHT|UP|DOWN|OK|BACK|HOME|TV)$/.test(key)){
      /* Never consume arrows while TV view is active: the original TV middleware owns them. */
      if(state.screen==='tv'&&key!=='HOME')return;
      if(e.preventDefault)e.preventDefault();
      advance(key);
    }
  },false);
  hero.onclick=function(){state.area='tvcard';advance('OK');};
  doc.getElementById('open-home').onclick=function(){advance('HOME');};
  doc.getElementById('detail-back').onclick=function(){advance('BACK');};
  render();
  return{getState:function(){return state;},send:function(key){advance(key);}};
}
var api={createModel:createModel,normalizeKey:normalizeKey,transition:transition,attachDocument:attachDocument};
root.BraviaLauncher=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof document!=='undefined'&&document.getElementById('tv-view'))attachDocument(document,root.BRAVIA_APPS);
}(typeof window!=='undefined'?window:global));