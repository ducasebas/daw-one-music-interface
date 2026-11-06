import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sensorTelemetry,readSensorTelemetry} from '../server/sensor-telemetry.js';
const good={schema:1,observedAt:10000,temperatureC:{status:'ok',value:19.5},lux:{status:'ok',value:485.74848}};
test('real sensors preserve units, identity and never grant amplifier verification',()=>{
 const s=sensorTelemetry(good,11000);assert.equal(s.temperature.value,19.5);assert.equal(s.light.value,485.74848);assert.equal(s.temperature.simulated,false);assert.equal(s.amplifierVerified,false);
});
test('stale, future, disconnected, saturated and nonfinite sensor values are unknown, never fabricated zero',()=>{
 for(const time of [30000,1000])assert.equal(sensorTelemetry(good,time).temperature.value,null);
 for(const patch of [{status:'error',value:0},{status:'ok',value:NaN},{status:'ok',value:Infinity},{status:'ok',value:-1}]){
 const s=sensorTelemetry({...good,lux:patch},11000);assert.equal(s.light.value,null);assert.equal(s.temperature.value,19.5);
 }
 assert.equal(readSensorTelemetry('/missing/sensor.json').temperature.value,null);assert.equal(readSensorTelemetry().enabled,false);
});
