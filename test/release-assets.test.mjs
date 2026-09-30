import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { COLLECTION_CATALOG } from '../src/collection-catalog.js';

const root = new URL('../public/', import.meta.url);
function files(path, prefix='') {
  return readdirSync(path, {withFileTypes:true}).flatMap(entry => {
    const name=prefix+entry.name;
    return entry.isDirectory() ? files(new URL(entry.name+'/',path),name+'/') : [name];
  });
}
test('public assets include only three vehicle models and their rendered gallery previews',()=>{
  assert.deepEqual(COLLECTION_CATALOG.map(item=>item.setNumber).sort(),['10295','42083','42115']);
  assert.deepEqual(readdirSync(new URL('official/',root)).sort(),['10295','42083','42115']);
  const published=files(root);
  for (const name of published.filter(name=>name.startsWith('lego-'))) assert.match(name,/^lego-(10295|42083|42115)-/);
  assert.ok(published.every(name=>!/(^|\/)(book-\d+|pages)(\/|$)/.test(name)));
  assert.ok(published.every(name=>!/^official\/\d+\/parts\//.test(name)));
  assert.ok(published.every(name=>! /\.(webp|jpe?g|pdf)$/i.test(name)));
  for (const name of published.filter(name=>/\.png$/i.test(name))) assert.match(name,/^official\/(10295|42083|42115)\/gallery-preview(?:-v2)?\.png$/);
  for (const entry of COLLECTION_CATALOG) assert.ok(existsSync(new URL(entry.thumbnail.slice(1),root)));
});
