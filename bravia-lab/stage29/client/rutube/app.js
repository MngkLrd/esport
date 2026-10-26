/* RUTUBE local client for older Cobalt/Chrome. ES5: no build tools, CDN or hosting.
 * The UI is NOT a replacement for HOME; it is the app launched from Sony HOME.
 */
(function(root, doc) {
 'use strict';
 var R = root.BraviaRutube, Remote = root.BraviaRemote, API = root.BraviaRutubeCatalog, HLS=root.BraviaNativeHls;
 var mode='home', homeIndex=0, cursorRow=0, cursorCol=0, resultIndex=0;
 var typing='', typedMode='search', searchResults=[], request=null;
 var frame=null, nativeVideo=null, streamRequest=null, backend='embed', fallbackPending=false;
 var ready=false, playing=false, playerId=null, playerReturn='home';
 var lastTime=0, lastDuration=0, readyTimeout=null;
 var searchRows=[
   ['А','Б','В','Г','Д','Е','Ё','Ж','З'],
   ['И','Й','К','Л','М','Н','О','П','Р'],
   ['С','Т','У','Ф','Х','Ц','Ч','Ш','Щ'],
   ['Ъ','Ы','Ь','Э','Ю','Я','0','1','2'],
   ['3','4','5','6','7','8','9','ПРОБЕЛ','⌫'],
   ['ОЧИСТИТЬ','НАЙТИ']
 ];
 var idRows=[
   ['0','1','2','3','4','5','6','7'],
   ['8','9','a','b','c','d','e','f'],
   ['⌫','ОЧИСТИТЬ','ОТКРЫТЬ']
 ];
 function el(id){return doc.getElementById(id);}
 function text(id,value){var n=el(id);if(n)n.textContent=value;}
 function show(view){var ids=['main','entry','results','player'],i;
   for(i=0;i<ids.length;i++)el(ids[i]).className=ids[i]+(ids[i]===view?'':' hidden');
 }
 function setStatus(message){text('status',message);}
 function updateHome(){var i;for(i=0;i<3;i++)el('tile'+i).className='tile'+(i===homeIndex?' active':'');}
 function rows(){return typedMode==='id'?idRows:searchRows;}
 function renderKeyboard(){
   var keyboard=el('keyboard'), view=rows(),i,j,row,key;
   while(keyboard.firstChild)keyboard.removeChild(keyboard.firstChild);
   for(i=0;i<view.length;i++){
     row=doc.createElement('div');row.className='keyrow';
     for(j=0;j<view[i].length;j++){
       key=doc.createElement('div');
       key.className='key'+(view[i][j].length>1?' special':'')+(i===cursorRow&&j===cursorCol?' active':'');
       key.textContent=view[i][j];
       row.appendChild(key);
     }
     keyboard.appendChild(row);
   }
   text('typed',typing || (typedMode==='id'?'Введите 32 символа ID видео':'Введите запрос для RUTUBE'));
 }
 function openEntry(kind){
   typedMode=kind;mode='entry';typing='';cursorRow=0;cursorCol=0;
   text('entryTitle',kind==='id'?'Видео по ID':'Поиск RUTUBE');show('entry');renderKeyboard();
 }
 function search(){
   var q=typing;mode='results';show('results');text('resultsList','');
   text('resultsList','Подключаемся к RUTUBE…');
   setStatus('Поиск через rutube.ru; потребуется интернет');
   request=API.search(q,function(err,list){
     if(mode!=='results')return;
     searchResults=list;resultIndex=0;
     if(err){text('resultsList',err.message+' — BACK для возврата.');return;}
     renderResults();
   });
 }
 function renderResults(){var target=el('resultsList'),i,node;
   while(target.firstChild)target.removeChild(target.firstChild);
   for(i=0;i<searchResults.length;i++){
     node=doc.createElement('div');node.className='result'+(i===resultIndex?' active':'');
     node.textContent=searchResults[i].title;target.appendChild(node);
   }
   if(target.children && target.children[resultIndex]){
     var item=target.children[resultIndex];if(typeof item.scrollIntoView==='function')item.scrollIntoView(false);
   }
 }
 function editKey(){var val=rows()[cursorRow][cursorCol];
   if(val==='⌫')typing=typing.substring(0,typing.length-1);
   else if(val==='ОЧИСТИТЬ')typing='';
   else if(val==='ПРОБЕЛ'&&typing.length<100)typing+=' ';
   else if(val==='НАЙТИ'){
     if(typing.replace(/\s/g,''))search();else setStatus('Сначала введите запрос');return;
   }else if(val==='ОТКРЫТЬ'){
     if(R.validId(typing))openVideo(typing,'Видео '+typing.substring(0,8), 'entry');
     else setStatus('ID должен состоять из 32 символов 0-9 или a-f');return;
   }else if(typing.length<(typedMode==='id'?32:100))typing+=val;
   renderKeyboard();
 }
 function post(name,data){return backend==='embed' && ready && frame && frame.contentWindow && R.command(frame.contentWindow,name,data);}
 function tryNativeHls(){
   if(mode!=='player'||backend!=='embed'||fallbackPending)return false;
   var trial=doc.createElement('video');
   if(!HLS.supported(trial)){text('playerStatus','Встроенный HLS не поддерживается. BACK — выход.');return false;}
   fallbackPending=true;text('playerStatus','Проверяем прямой HLS-поток RUTUBE…');
   streamRequest=HLS.get(playerId,function(err,url){
     fallbackPending=false;if(mode!=='player'||backend!=='embed')return;
     if(err){text('playerStatus','HLS недоступен: '+err.message);return;}
     if(frame){frame.setAttribute('src','about:blank');if(frame.parentNode)frame.parentNode.removeChild(frame);}frame=null;
     backend='native';ready=true;nativeVideo=trial;
     trial.setAttribute('controls','');trial.setAttribute('playsinline','');
     trial.setAttribute('src',url);
     trial.onerror=function(){text('playerStatus','HLS не декодируется движком Sony');};
     trial.onloadedmetadata=function(){text('playerStatus','HTML5 HLS запущен, управление с пульта');};
     el('videoArea').appendChild(trial);
     if(typeof trial.play==='function')try{trial.play();playing=true;}catch(ex){}
   });
   return true;
 }
 function openVideo(id,title,ret){
   if(!R.validId(id))return false;
   if(request && typeof request.abort==='function')request.abort();request=null;
   playerReturn=ret||mode;mode='player';show('player');ready=false;playing=false;
   lastTime=0;lastDuration=0;playerId=id;backend='embed';fallbackPending=false;nativeVideo=null;
   text('videoTitle',title || 'RUTUBE');
   text('playerStatus','Соединение с плеером RUTUBE…');text('playTime','');
   var holder=el('videoArea');
   while(holder.firstChild)holder.removeChild(holder.firstChild);
   frame=doc.createElement('iframe');frame.id='rutube-iframe';
   frame.setAttribute('src',R.embedUrl(id));
   frame.setAttribute('allow','autoplay; fullscreen');
   frame.setAttribute('allowfullscreen','allowfullscreen');
   frame.setAttribute('frameborder','0');
   holder.appendChild(frame);
   if(readyTimeout)root.clearTimeout(readyTimeout);
   readyTimeout=root.setTimeout(function(){
     if(mode==='player'&&!ready)text('playerStatus','Плеер не ответил. Возможны ограничения Cobalt/TLS или сети. BACK — выход.');
   },15000);
   return true;
 }
 function closePlayer(){
   if(streamRequest&&typeof streamRequest.abort==='function')streamRequest.abort();streamRequest=null;fallbackPending=false;
   if(ready)post('player:stop',{});
   if(nativeVideo){try{nativeVideo.pause();}catch(ex){}nativeVideo.setAttribute('src','');
       if(nativeVideo.parentNode)nativeVideo.parentNode.removeChild(nativeVideo);nativeVideo=null;}
   if(readyTimeout)root.clearTimeout(readyTimeout);readyTimeout=null;
   if(frame){frame.setAttribute('src','about:blank'); if(frame.parentNode)frame.parentNode.removeChild(frame);}
   frame=null;ready=false;playing=false;playerId=null;
   mode=playerReturn==='results'?'results':playerReturn==='entry'?'entry':'home';show(mode==='home'?'main':mode);
   if(mode==='entry')renderKeyboard();if(mode==='results')renderResults();
 }
 function onMessage(event){
   if(mode!=='player'||backend!=='embed'||!frame||!R.isTrustedMessage(event,frame.contentWindow))return;
   var msg=R.decode(event.data);if(!msg)return;
   if(msg.type==='player:ready'){
     ready=true;playing=true;if(readyTimeout)root.clearTimeout(readyTimeout);
     text('playerStatus','Управление пультом активно');post('player:play',{});
   }else if(msg.type==='player:error'){
     text('playerStatus','Ошибка RUTUBE: '+String(msg.data && msg.data.code || 'неизвестная'));
   }else if(msg.type==='player:currentTime'){
     if(msg.data&&typeof msg.data.time==='number')lastTime=msg.data.time;
     text('playTime',fmt(lastTime)+(lastDuration?' / '+fmt(lastDuration):''));
   }else if(msg.type==='player:durationChange'){
     if(msg.data&&typeof msg.data.duration==='number')lastDuration=msg.data.duration;
   }else if(msg.type==='player:playComplete'){
     playing=false;text('playerStatus','Видео завершено · OK повторить');
   }else if(msg.type==='player:changeState'){
     var st=msg.data&&msg.data.state;
     if(typeof st==='string' || typeof st==='number')text('playerStatus','Состояние: '+String(st).substring(0,40));
   }
 }
 function fmt(n){var s=Math.floor(n||0);return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2);}
 function keys(action){
   var view,i;
   if(!action)return false;
   if(mode==='home'){
     if(action==='left')homeIndex=(homeIndex+2)%3;
     else if(action==='right')homeIndex=(homeIndex+1)%3;
     else if(action==='ok'){
       if(homeIndex===0)openVideo(R.DEMO_ID,'RUTUBE · тестовое видео','home');
       else openEntry(homeIndex===1?'search':'id');return true;
     }else if(action==='back'){setStatus('Для возврата в HOME используйте кнопку HOME на пульте Sony');return false;}
     else return false;
     updateHome();return true;
   }
   if(mode==='entry'){
     view=rows();
     if(action==='up')cursorRow=(cursorRow+view.length-1)%view.length;
     else if(action==='down')cursorRow=(cursorRow+1)%view.length;
     else if(action==='left')cursorCol=(cursorCol+view[cursorRow].length-1)%view[cursorRow].length;
     else if(action==='right')cursorCol=(cursorCol+1)%view[cursorRow].length;
     else if(action==='ok'){editKey();return true;}
     else if(action==='back'){mode='home';show('main');updateHome();return true;}
     else return false;
     if(cursorCol>=view[cursorRow].length)cursorCol=view[cursorRow].length-1;
     renderKeyboard();return true;
   }
   if(mode==='results'){
     if(action==='up')resultIndex=Math.max(0,resultIndex-1);
     else if(action==='down')resultIndex=Math.min(searchResults.length-1,resultIndex+1);
     else if(action==='ok'){
       if(searchResults.length)openVideo(searchResults[resultIndex].id,searchResults[resultIndex].title,'results');return true;
     }else if(action==='back'){
       if(request&&typeof request.abort==='function')request.abort();request=null;
       mode='entry';show('entry');renderKeyboard();return true;
     }else return false;
     renderResults();return true;
   }
   if(mode==='player'){
     if(action==='back'){closePlayer();return true;}
     if(action==='left'||action==='rewind'){
       if(backend==='native'&&nativeVideo){try{nativeVideo.currentTime=Math.max(0,nativeVideo.currentTime-10);}catch(ex){}}
       else if(post('player:relativelySeek',{time:-10}))text('playerStatus','−10 секунд');return true;}
     if(action==='right'||action==='fast-forward'){
       if(backend==='native'&&nativeVideo){try{nativeVideo.currentTime=nativeVideo.currentTime+10;}catch(ex){}}
       else if(post('player:relativelySeek',{time:10}))text('playerStatus','+10 секунд');return true;}
     if(action==='ok'||action==='play'||action==='pause'){
       var next=action==='play'?true:action==='pause'?false:!playing;
       if(backend==='native'&&nativeVideo){try{if(next)nativeVideo.play();else nativeVideo.pause();playing=next;}catch(ex){}}
       else if(post(next?'player:play':'player:pause',{})){playing=next;text('playerStatus',next?'Воспроизведение':'Пауза');}
       return true;
     }
     if(action==='stop'){closePlayer();return true;}
     if(action==='down')return tryNativeHls();
     if(action==='up')return true;
   }
   return false;
 }
 function onKey(event){var action=Remote.normalize(event);if(keys(action)){
   if(event.preventDefault)event.preventDefault();if(event.stopPropagation)event.stopPropagation();
 }}
 function setup(){
   doc.addEventListener('keydown',onKey,false);
   root.addEventListener('message',onMessage,false);
   doc.addEventListener('click',function(event){
     var node=event.target;
     while(node && node!==el('shell')){
       if(node.id==='tile0'||node.id==='tile1'||node.id==='tile2'){
         homeIndex=Number(node.id.charAt(4));updateHome();keys('ok');return;
       }
       node=node.parentNode;
     }
   });
   updateHome();show('main');
 }
 setup();
 /* Methods used only by isolated tests / optional OEM host bridge. */
 root.BraviaRutubeApp={handleAction:keys,showDemo:function(){return openVideo(R.DEMO_ID,'RUTUBE','home');},
   mode:function(){return mode;},stop:closePlayer};
}(this,document));
