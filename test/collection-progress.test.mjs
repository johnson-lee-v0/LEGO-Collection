import test from 'node:test';
import assert from 'node:assert/strict';
import {createProgressStore, PROGRESS_KEY, LEGACY_IMPORT_KEY} from '../src/collection-progress.js';
import {COLLECTION_CATALOG} from '../src/collection-catalog.js';
import {getModel, listModels} from '../src/model-registry.js';

const memoryStorage = () => {
  const data = new Map();
  return {getItem:key=>data.get(key)??null, setItem:(key,value)=>data.set(key,String(value))};
};
const build = (id, placedCount, totalCount=196) => ({blueprintId:id, placedCount, totalCount, title:id});

test('local progress survives reload, undo, reset and independent builds', () => {
  const storage=memoryStorage(), first=createProgressStore(storage);
  first.save(build('sian',196)); first.save(build('porsche',17,366));
  const reload=createProgressStore(storage);
  assert.equal(reload.read().find(s=>s.blueprintId==='sian').completed,true);
  reload.save(build('sian',195));
  assert.equal(reload.read().find(s=>s.blueprintId==='sian').completed,false);
  reload.save(build('sian',0));
  assert.deepEqual(reload.read().map(s=>[s.blueprintId,s.placedCount]),[['porsche',17],['sian',0]]);
});

test('legacy import is read-only, runs once, and never overwrites local progress', async () => {
  const storage=memoryStorage(), store=createProgressStore(storage);
  storage.setItem('keepsake-owner','existing-owner'); store.save(build('sian',0));
  const calls=[];
  const fetcher=async (url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({sets:[build('sian',196),{...build('porsche',300,366),shareId:'private-share',ownerId:'private-owner'}]})};};
  await store.importLegacy(fetcher); await store.importLegacy(fetcher);
  assert.equal(calls.length,1); assert.equal(calls[0].url,'/api/me');
  assert.equal(calls[0].options.method,undefined); assert.equal(calls[0].options.headers['X-Owner-Token'],'existing-owner');
  assert.equal(store.read().find(s=>s.blueprintId==='sian').placedCount,0);
  assert.equal(store.read().find(s=>s.blueprintId==='porsche').placedCount,300);
  assert.doesNotMatch(storage.getItem(PROGRESS_KEY),/private-share|private-owner/);
  assert.equal(storage.getItem(LEGACY_IMPORT_KEY),'complete');
});

test('static visitors make no API call and unavailable legacy service does not block saving', async () => {
  const storage=memoryStorage(), store=createProgressStore(storage);
  await store.importLegacy(()=>{throw new Error('Must not fetch for a new visitor');});
  storage.setItem('keepsake-owner','old-owner');
  await store.importLegacy(async()=>{throw new Error('Static host has no API');});
  assert.equal(storage.getItem(LEGACY_IMPORT_KEY),null);
  store.save(build('sian',4));
  assert.equal(store.read()[0].placedCount,4);
});

test('denied storage reads keep the gallery usable and saving reports an error', async () => {
  let wrote=false, fetched=false;
  const denied=new DOMException('Site storage is denied', 'SecurityError');
  const store=createProgressStore({getItem(){throw denied;},setItem(){wrote=true;}});
  assert.deepEqual(store.read(),[]);
  assert.deepEqual(await store.importLegacy(async()=>{fetched=true;}),[]);
  assert.throws(()=>store.save(build('sian',5)),{name:'SecurityError'});
  assert.equal(fetched,false);
  assert.equal(wrote,false,'failed reads must not overwrite uninspected existing progress');
});

test('denied access to the localStorage property also permits startup', async () => {
  const store=createProgressStore(()=>{throw new DOMException('Access denied','SecurityError');});
  assert.deepEqual(store.read(),[]);
  assert.deepEqual(await store.importLegacy(),[]);
  assert.throws(()=>store.save(build('sian',1)),{name:'SecurityError'});
});

test('invalid imported progress is ignored and counts are bounded', () => {
  const store=createProgressStore(memoryStorage());
  store.importBuilds([build('valid',200),build('negative',-1),build('no-total',1,0),build('fraction',1.5)]);
  assert.deepEqual(store.read().map(s=>[s.blueprintId,s.placedCount,s.completed]),[['valid',196,true]]);
});

test('lightweight gallery metadata agrees with visible full models', () => {
  assert.deepEqual(COLLECTION_CATALOG.map(item=>item.alias),listModels().filter(item=>item.galleryVisible).map(item=>item.alias));
  for (const entry of COLLECTION_CATALOG) {
    const model=getModel(entry.alias);
    for (const key of ['id','title','shortTitle','setNumber','year','pieceCount','progressTotal','thumbnail']) assert.equal(entry[key],model[key],`${entry.alias}.${key}`);
  }
});
