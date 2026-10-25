/*
 * Sony KD-55XG7096 v8.931 HOME research bridge (OFF-DEVICE; not firmware).
 * These calls originate from shipped Cobalt HTML5 HOME files, not a generic
 * browser API. Only available within Sony's trusted HOME context.
 * No shell commands, app installs, firmware writes or arbitrary URLs.
 */
(function(root) {
  'use strict';
  var TITLES = {settings:'System Settings',channels:'Programme List'};
  function hasSonyHomeContext() {
    var b=root && root.HomeuiInterface;
    return !!(b && typeof b.LaunchMenu==='function' &&
                  typeof b.GetMenu==='function');
  }
  function openNative(action) {
    // GetExtInputs only lists inputs. No confirmed native selector call yet.
    if (!Object.prototype.hasOwnProperty.call(TITLES, action)) return false;
    if (!hasSonyHomeContext()) return false;
    try {
      root.HomeuiInterface.LaunchMenu(JSON.stringify({text:TITLES[action]}));
      return true;
    } catch (_err) {
      return false;
    }
  }
  root.BraviaNativeBridge={openNative:openNative,hasSonyHomeContext:hasSonyHomeContext};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.BraviaNativeBridge;
}(typeof window!=='undefined'?window:(typeof global!=='undefined'?global:this)));
