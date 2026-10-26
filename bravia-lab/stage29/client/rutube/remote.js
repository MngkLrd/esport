/* ES5 only. Tested key map; do not consume POWER, VOLUME, CHANNEL, OPTIONS. */
(function(root) {
  'use strict';
  var KEY = {
    37:'left', 38:'up', 39:'right', 40:'down', 13:'ok',
    8:'back', 27:'back', 461:'back', 10009:'back',
    415:'play', 19:'pause', 413:'stop', 417:'fast-forward', 412:'rewind'
  };
  function normalize(event) {
    var code = event && (event.keyCode || event.which);
    var key = event && event.key;
    if (code && KEY[code]) return KEY[code];
    if (key === 'ArrowLeft') return 'left';
    if (key === 'ArrowRight') return 'right';
    if (key === 'ArrowUp') return 'up';
    if (key === 'ArrowDown') return 'down';
    if (key === 'Enter') return 'ok';
    if (key === 'Escape' || key === 'Backspace') return 'back';
    return null;
  }
  root.BraviaRemote = {normalize: normalize};
}(typeof module !== 'undefined' && module.exports ? module.exports : this));
