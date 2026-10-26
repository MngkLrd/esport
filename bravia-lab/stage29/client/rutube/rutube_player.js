/* Official RUTUBE iframe postMessage API; never intercept DRM or media URLs.
 * The iframe may not load on older Sony Cobalt firmware. Failure is surfaced.
 */
(function(root) {
  'use strict';
  var ORIGIN = 'https://rutube.ru';
  var DEMO_ID = '7716bd3e665725c3c008ae7ab4ff02e2'; /* published by Rutube embed docs */
  function validId(id) { return typeof id === 'string' && /^[0-9a-f]{32}$/i.test(id); }
  function embedUrl(id) { return validId(id) ? ORIGIN + '/play/embed/' + id.toLowerCase() : null; }
  function decode(data) {
    var obj = data;
    if (typeof data === 'string') {
      if (data.length > 30000) return null;
      try { obj = JSON.parse(data); } catch (e) { return null; }
    }
    return obj && typeof obj === 'object' && typeof obj.type === 'string' &&
      obj.type.indexOf('player:') === 0 ? obj : null;
  }
  function isTrustedMessage(event, source) {
    return !!event && event.origin === ORIGIN && event.source === source;
  }
  function command(frameWindow, name, data) {
    if (!frameWindow || typeof frameWindow.postMessage !== 'function') return false;
    var allowed = {'player:play':1,'player:pause':1,'player:stop':1,
      'player:relativelySeek':1};
    if (!allowed[name]) return false;
    frameWindow.postMessage(JSON.stringify({type:name,data:data || {}}), ORIGIN);
    return true;
  }
  root.BraviaRutube = {
    DEMO_ID:DEMO_ID, ORIGIN:ORIGIN,validId:validId,embedUrl:embedUrl,
    decode:decode,isTrustedMessage:isTrustedMessage,command:command
  };
}(typeof module !== 'undefined' && module.exports ? module.exports : this));
