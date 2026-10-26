/* Optional HTMLMediaElement/HLS compatibility path for older Sony engines.
 * Reads public RUTUBE play options. No proxy, DRM bypass, transcoding or caching.
 * This is conditional: Cobalt must implement HLS video and allow API CORS.
 */
(function(root){
 'use strict';
 function validateMedia(url){
   if(typeof url!=='string'||url.length>2048)return false;
   var match=/^https:\/\/([a-z0-9.-]+)(\/[^\s?#]*)/i.exec(url);
   if(!match)return false;
   var host=match[1].toLowerCase();
   return (host==='rutube.ru'||host.substring(host.length-10)==='.rutube.ru') &&
      /\.m3u8$/i.test(match[2]);
 }
 function playlistFrom(raw){
   var url=raw&&raw.video_balancer&&raw.video_balancer.m3u8;
   if(validateMedia(url))return url;
   var live=raw&&raw.live_streams&&raw.live_streams.hls;
   if(live&&Object.prototype.toString.call(live)==='[object Array]'){
     for(var i=0;i<live.length;i++)if(live[i]&&validateMedia(live[i].url))return live[i].url;
   }
   return null;
 }
 function supported(video){
   if(!video||typeof video.canPlayType!=='function')return false;
   return !!(video.canPlayType('application/vnd.apple.mpegurl') ||
     video.canPlayType('application/x-mpegURL'));
 }
 function get(id,callback,factory){
   if(typeof id!=='string'||!/^[0-9a-f]{32}$/i.test(id)){
     callback(new Error('Invalid video ID'),null);return null;
   }
   var xhr=(factory||function(){return new XMLHttpRequest();})();var done=false;
   function finish(err,url){if(done)return;done=true;callback(err,url||null);}
   xhr.open('GET','https://rutube.ru/api/play/options/'+id.toLowerCase()+'/?format=json',true);
   xhr.timeout=9000;
   xhr.onreadystatechange=function(){
     if(xhr.readyState!==4)return;
     if(xhr.status!==200){finish(new Error('RUTUBE stream API HTTP '+xhr.status),null);return;}
     var data;try{data=JSON.parse(xhr.responseText);}catch(e){finish(new Error('Bad stream response'),null);return;}
     var media=playlistFrom(data);
     finish(media?null:new Error('No compatible HLS manifest'),media);
   };
   xhr.onerror=function(){finish(new Error('CORS or network blocked'),null);};
   xhr.ontimeout=function(){finish(new Error('Stream API timeout'),null);};
   try{xhr.send(null);}catch(e){finish(new Error('Stream request blocked'),null);}
   return xhr;
 }
 root.BraviaNativeHls={validateMedia:validateMedia,playlistFrom:playlistFrom,supported:supported,get:get};
}(typeof module !== 'undefined'&&module.exports?module.exports:this));
