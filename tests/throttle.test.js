import test from 'node:test';
import assert from 'node:assert/strict';
import {throttleTelemetry,HostTelemetry,throttlePaths} from '../server/host-telemetry.js';
test('decodes the firmware throttle flags now and since boot',()=>{
 assert.deepEqual(throttleTelemetry('throttled=0x0'),null,'only the sysfs value form is accepted');
 const ok=throttleTelemetry('0');assert.equal(ok.now.underVoltage,false);assert.equal(ok.sinceBoot.throttled,false);
 const v=throttleTelemetry('50005');// under-voltage now and since boot, throttled now and since boot
 assert.deepEqual(v.now,{underVoltage:true,frequencyCapped:false,throttled:true,softTemperatureLimit:false});
 assert.deepEqual(v.sinceBoot,{underVoltage:true,frequencyCapped:false,throttled:true,softTemperatureLimit:false});
 assert.equal(throttleTelemetry('80000').sinceBoot.softTemperatureLimit,true);assert.equal(throttleTelemetry('zz'),null);
});
test('host telemetry includes throttle flags when the firmware path is readable',()=>{
 const host=new HostTelemetry({readFile:p=>p===throttlePaths[0]?'20000\n':'',files:()=>[],execute:()=>{}});
 assert.equal(host.sample().throttle.sinceBoot.frequencyCapped,true);
 assert.equal(new HostTelemetry({readFile:()=>'',files:()=>[],execute:()=>{}}).sample().throttle,null);
});
