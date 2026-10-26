/* Unofficial read-only RUTUBE public search endpoint, no proxy or credentials.
 * Search from local file origin may fail CORS; timeout and human error shown.
 */
(function(root) {
  'use strict';
  function resultsFrom(response) {
    var arr = response && (response.results || response.items || response.videos);
    var parsed = [], i, row, id, title;
    if (!arr || Object.prototype.toString.call(arr) !== '[object Array]') return parsed;
    for (i=0;i<arr.length && parsed.length<16;i++) {
      row=arr[i];
      if (!row || typeof row!=='object') continue;
      id=row.id || row.video_id;
      title=row.title || row.name || '';
      if (typeof id==='string' && /^[0-9a-f]{32}$/i.test(id) && typeof title==='string') {
        parsed.push({id:id.toLowerCase(), title:title.substring(0,110)});
      }
    }
    return parsed;
  }
  function search(query, complete, xhrFactory) {
    if (typeof query !== 'string' || !query.replace(/\s/g,'') || query.length>100) {
      complete(new Error('Введите запрос длиной до 100 символов'), []);return null;
    }
    var xhr = (xhrFactory || function(){return new XMLHttpRequest();})();
    var done = false;
    function finish(err, items) {if(done)return;done=true;complete(err,items||[]);}
    xhr.open('GET','https://rutube.ru/api/search/video/?query=' + encodeURIComponent(query) + '&page=1&limit=12&format=json',true);
    xhr.timeout = 9000;
    xhr.onreadystatechange = function() {
      if (xhr.readyState!==4)return;
      if(xhr.status!==200){finish(new Error('RUTUBE не ответил (HTTP ' + xhr.status + '). Возможно, соединение или CORS.'),[]);return;}
      var obj;
      try {obj=JSON.parse(xhr.responseText);} catch(e){finish(new Error('Неверный ответ RUTUBE'),[]);return;}
      var entries=resultsFrom(obj);
      finish(entries.length?null:new Error('Видео не найдены или формат API изменился'),entries);
    };
    xhr.onerror=function(){finish(new Error('Сетевой запрос или CORS заблокирован'),[]);};
    xhr.ontimeout=function(){finish(new Error('Истекло время ожидания ответа'),[]);};
    try {xhr.send(null);} catch(e){finish(new Error('API недоступен в этом движке'),[]);}
    return xhr;
  }
  root.BraviaRutubeCatalog={resultsFrom:resultsFrom, search:search};
}(typeof module !== 'undefined' && module.exports ? module.exports : this));
