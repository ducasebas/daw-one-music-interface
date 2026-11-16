import test from 'node:test';
import assert from 'node:assert/strict';
import {authority,sameOrigin,trustedHost} from '../server/request-policy.js';
import {validDeviceRequest,controlToken} from '../server/device-client.js';
import {musicEndpoint,musicToken,environmentValue} from '../deploy/manager/music-credentials.mjs';
const request=headers=>({get:key=>Object.entries(headers).find(([k])=>k.toLowerCase()===key.toLowerCase())?.[1]});
test('browser origins cannot forge a proxy host or fetch the control nonce cross-site',()=>{
 const q=request({Host:'127.0.0.1:3001',Origin:'https://evil.test','X-Forwarded-Host':'evil.test','X-TuneBox-Control':controlToken});
 assert.equal(sameOrigin(q),false);assert.equal(validDeviceRequest(q),false);
 assert.equal(sameOrigin(request({Host:'localhost:5173',Origin:'http://localhost:5173'})),true);
 assert.equal(sameOrigin(request({Host:'localhost',Origin:'null'})),false);
 assert.equal(sameOrigin(request({Host:'localhost','Sec-Fetch-Site':'cross-site'})),false);
});
test('Host must identify this appliance, not an arbitrary DNS-rebinding name',()=>{
 const options={name:'dawdev',interfaces:{wlan0:[{address:'10.69.0.203'}]},extra:'tunebox.example.net'};
 for(const host of ['localhost:3001','127.0.0.1:5173','[::1]:3001','dawdev.local','10.69.0.203:3001','tunebox.example.net'])assert.equal(trustedHost(request({Host:host}),options),true,host);
 for(const host of ['evil.local','10.69.0.204','user@localhost','localhost/evil','localhost:99999','localhost\\evil'])assert.equal(trustedHost(request({Host:host}),options),false,host);
 assert.equal(authority('localhost:3001').host,'localhost:3001');
 assert.equal(trustedHost({...request({Host:'10.42.0.1:3003'}),provisioning:true},options),true);
});
test('saved Music Assistant credential is scoped to the original server endpoint',()=>{
 const original={currentUrl:'http://music.local:8095',storedToken:'private-token'};
 assert.equal(musicToken({...original,url:'ws://music.local:8095/ws'}),'private-token');
 for(const url of ['http://other.local:8095','http://music.local:8096','https://music.local:8095','http://music.local:8095/bad'])assert.equal(musicToken({...original,url}),'');
 assert.equal(musicToken({...original,url:'http://other.local:8095',token:'new-token'}),'new-token');
 assert.equal(musicEndpoint('wss://MUSIC.local/ws'),'wss://music.local:443/ws');
 assert.equal(environmentValue('MA_URL=http://old.local\nMA_URL="http://new.local:8095"\n','MA_URL'),'http://new.local:8095');
});
