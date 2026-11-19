import test from 'node:test';
import assert from 'node:assert/strict';
import {meterScale,meterFraction,meterAngle,meterMarks,polar} from '../shared/meter-scale.js';

test('peak meter prints dB marks where the needle points',()=>{
 assert.equal(meterAngle(-60,'meters'),-60);assert.equal(meterAngle(0,'meters'),60);assert.equal(meterAngle(-30,'meters'),0);
 assert.equal(meterFraction(-96,'meters'),0);assert.equal(meterFraction(6,'meters'),1);assert.equal(meterFraction(NaN,'meters'),0);
 const marks=meterMarks('meters');
 assert.deepEqual(marks.filter(m=>m.label).map(m=>m.label),['−60','−40','−20','−10','0']);
 assert.deepEqual(marks.filter(m=>m.hot).map(m=>m.value),[-3,0]);
 for(let i=1;i<marks.length;i++)assert.ok(marks[i].angle>marks[i-1].angle);
});
test('VU scale runs from −20 to +3 with the red zone above 0 VU',()=>{
 const s=meterScale('vu');assert.equal(s.min,-20);assert.equal(s.max,3);
 assert.equal(meterAngle(-20,'vu'),-60);assert.equal(meterAngle(3,'vu'),60);
 const marks=meterMarks('vu');assert.deepEqual(marks.filter(m=>m.hot).map(m=>m.label||m.value),[1,2,'+3']);
 assert.ok(marks.some(m=>m.label==='0'));
 // Voltage response: 0 VU sits near 70 % of the sweep, and labels never crowd each other.
 assert.ok(Math.abs(meterFraction(0,'vu')-.686)<.01);
 const labelled=marks.filter(m=>m.label);for(let i=1;i<labelled.length;i++)assert.ok(labelled[i].angle-labelled[i-1].angle>=10,labelled[i].label);
});
test('polar points sit on the needle circle',()=>{
 const [x,y]=polar(120,132,100,0);assert.equal(Math.round(x),120);assert.equal(Math.round(y),32);
 const [x2]=polar(120,132,100,90);assert.equal(Math.round(x2),220);
});
