import test from 'node:test';
import assert from 'node:assert/strict';
import {measurementStatus,sweepEstimateMs} from '../deploy/manager/measurement.mjs';

const base={supported:true,microphones:[{id:'hw:2,0',name:'UMIK-1'}],output:'plughw:CARD=LouderRaspberry,DEV=0'};
test('a running sweep reports its remaining seconds without exposing the internal estimate',()=>{
 const now=1_000_000,value=measurementStatus({...base,running:true},{phase:'measuring-left',percent:5,observedAt:now,estimatedEndAt:now+sweepEstimateMs['measuring-left']},now+3000);
 assert.equal(value.remainingSeconds,12);assert.equal('estimatedEndAt' in value,false);assert.equal(value.phase,'measuring-left');
 assert.equal(measurementStatus({...base,running:true},{phase:'analysing',observedAt:now,estimatedEndAt:now},now+5000).remainingSeconds,1);
});
test('a sweep that stopped without a final phase becomes a retryable failure instead of queued forever',()=>{
 const now=1_000_000;
 for(const phase of ['queued','measuring-left','measuring-right','analysing']){
  const stale=measurementStatus({...base,running:false},{phase,observedAt:now},now+20001);
  assert.equal(stale.phase,'failed',phase);assert.match(stale.error,/stopped before it finished/);
 }
 // The service may still be starting right after the request.
 assert.equal(measurementStatus({...base,running:false},{phase:'queued',observedAt:now},now+2000).phase,'queued');
 // Final phases are left alone.
 for(const phase of ['complete','cancelled','failed'])assert.equal(measurementStatus({...base,running:false},{phase,observedAt:now},now+99999).phase,phase);
});
test('the device manager accepts only the three sweep levels',async()=>{
 const {validateRequest}=await import('../shared/device-manager.js');
 const base={command:'measurement-start',args:{microphone:'hw:4,0',confirmed:true,profile:{}}};
 for(const level of [undefined,-36,-30,-24])assert.doesNotThrow(()=>validateRequest({...base,args:{...base.args,...(level===undefined?{}:{levelDbfs:level})}}));
 for(const level of [-12,0,-30.5,'-30'])assert.throws(()=>validateRequest({...base,args:{...base.args,levelDbfs:level}}),/supported sweep level/);
});
