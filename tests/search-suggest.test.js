import test from 'node:test';
import assert from 'node:assert/strict';
import {searchTerm,searchTooShort,createSearchCache,searchCacheKey,searchMinimum,searchDebounceMs} from '../shared/search-suggest.js';

test('search starts at three characters and waits about 250 ms',()=>{
 assert.equal(searchMinimum,3);assert.equal(searchDebounceMs,250);
 assert.equal(searchTerm('ab'),'');assert.equal(searchTerm('  ab  '),'');assert.equal(searchTerm(' abc '),'abc');
 assert.equal(searchTooShort(''),false);assert.equal(searchTooShort('a'),true);assert.equal(searchTooShort('ab '),true);assert.equal(searchTooShort('abc'),false);
});
test('the prefix cache is bounded, expires and is case-insensitive per prefix',()=>{
 let t=0;const cache=createSearchCache({limit:2,ttl:1000,now:()=>t});
 const key=q=>searchCacheKey({term:searchTerm(q),kind:'albums'});
 assert.equal(key('Abba'),key('abba'));assert.notEqual(key('abb'),key('abba'));
 assert.equal(key('ab'),key(''));
 cache.set(key('abb'),1);cache.set(key('abba'),2);assert.equal(cache.get(key('abb')),1);
 cache.set(key('abc'),3);assert.equal(cache.size,2);assert.equal(cache.get(key('abba')),undefined,'least recently used entry is evicted');
 t=1001;assert.equal(cache.get(key('abb')),undefined,'expired entries are not reused');
});
