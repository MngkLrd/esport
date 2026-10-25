const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../ui/sony_native_bridge.js'),'utf8');
function fresh(native){let ctx={module:{exports:{}}};if(native!==undefined)ctx.HomeuiInterface=native;vm.createContext(ctx);vm.runInContext(code,ctx);return ctx.BraviaNativeBridge;}
function mock(){const calls=[];return {calls,api:{GetMenu(){return '{}'},LaunchMenu(v){calls.push(JSON.parse(v))}}};}
test('no native context fails closed',()=>assert.equal(fresh().openNative('settings'),false));
test('missing GetMenu fails closed',()=>assert.equal(fresh({LaunchMenu(){}}).openNative('settings'),false));
test('Sony context detected',()=>assert.equal(fresh(mock().api).hasSonyHomeContext(),true));
test('settings dispatched to Sony',()=>{const m=mock();assert.equal(fresh(m.api).openNative('settings'),true);assert.deepEqual(m.calls,[{text:'System Settings'}]);});
test('channels dispatched to Sony',()=>{const m=mock();assert.equal(fresh(m.api).openNative('channels'),true);assert.deepEqual(m.calls,[{text:'Programme List'}]);});
test('input selection remains blocked',()=>{const m=mock();assert.equal(fresh(m.api).openNative('inputs'),false);assert.equal(m.calls.length,0);});
test('arbitrary app action rejected',()=>assert.equal(fresh(mock().api).openNative('netflix'),false));
test('arbitrary path action rejected',()=>assert.equal(fresh(mock().api).openNative('../../tmp'),false));
test('null action rejected',()=>assert.equal(fresh(mock().api).openNative(null),false));
test('prototype-name action rejected',()=>assert.equal(fresh(mock().api).openNative('__proto__'),false));
test('native throw fails closed',()=>assert.equal(fresh({GetMenu(){return '{}'},LaunchMenu(){throw Error('failure')}}).openNative('settings'),false));
test('native no return value counts only as call dispatched',()=>assert.equal(fresh(mock().api).openNative('settings'),true));
test('bridge never tunes channels',()=>{const m=mock();m.api.TuneToChannel=()=>{throw Error('unexpected tune')};assert.equal(fresh(m.api).openNative('channels'),true);});
test('bridge does not query inputs in lieu of selector',()=>{const m=mock();m.api.GetExtInputs=()=>{throw Error('unexpected read')};assert.equal(fresh(m.api).openNative('inputs'),false);});
test('non-callable LaunchMenu rejected',()=>assert.equal(fresh({GetMenu(){return '{}'},LaunchMenu:1}).openNative('settings'),false));
