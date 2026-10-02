import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { COLLECTION_CATALOG } from '../src/collection-catalog.js';
import { getModel, listModels } from '../src/model-registry.js';

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

test('the public release excludes full booklet, inventory and synchronized-build datasets',()=>{
  const rootFiles=new Set([
    'favicon.svg','about.html','LICENSE.txt','THIRD-PARTY-NOTICES.txt',
    'sian-official-set.md','chiron-official-set.md','porsche-official-set.md',
    'model-10295-inventory.csv','model-42083-inventory.csv','model-42115-inventory.csv',
  ]);
  const modelFiles=new Set([
    'MODEL-CREDITS.md','gallery-preview.png','gallery-preview-v2.png',
    'instances.json','ldraw-manifest.json','model-inventory.json','element-crosswalk.json',
    'model-provenance.json','model-summary.json','model.mpd',
    'source-model.mpd','source-structure.json',
  ]);
  for(const name of files(root)){
    if(rootFiles.has(name))continue;
    const match=name.match(/^official\/(10295|42083|42115)\/(.+)$/);
    assert.ok(match,`Unreviewed public asset: ${name}`);
    assert.ok(modelFiles.has(match[2]) || /^ldraw\/.+\.(?:dat|ldr)$/i.test(match[2]) || /^ldraw\/(?:Readme|CAreadme|CAlicense)\.txt$/.test(match[2]),
      `Unreviewed model asset: ${name}`);
  }
  const sourceFiles=files(new URL('../src/',import.meta.url));
  assert.deepEqual(sourceFiles.filter(name=>/(?:^|\/)(?:(?:sian|chiron|porsche)-(?:instructions|inventory|build-steps|model|step-parts|step-actions(?:-[\w-]+)?)|official-source|collection-progress)\.js$/.test(name)),[]);
});

test('all three viewer entries distinguish model inventory from retail set counts',()=>{
  const expected=[
    {alias:'sian',set:'42115',modeled:3696,retail:3696,author:'Jens Brühl (jb70)',books:2},
    {alias:'chiron',set:'42083',modeled:3590,retail:3599,author:'Philippe Hurbain (Philo)',books:2},
    {alias:'porsche',set:'10295',modeled:1363,retail:1458,author:'Ulrich Röder (UR)',books:1},
  ];
  assert.equal(listModels().length,3);
  assert.equal(new Set(listModels().map(model=>model.id)).size,3);
  for(const entry of expected){
    const model=getModel(entry.alias);
    assert.equal(model,getModel(model.id));
    assert.equal(model.setNumber,entry.set);
    assert.equal(model.buildMode,'viewer');
    assert.deepEqual(model.steps,[]);
    assert.equal(model.inventory,undefined);
    assert.equal(model.progressTotal,undefined);
    assert.equal(model.modeledPieceCount,entry.modeled);
    assert.equal(model.pieceCount,entry.retail);
    assert.equal(model.author,entry.author);
    assert.equal(model.modelUrl,`/official/${entry.set}/model.mpd`);
    assert.equal(model.sceneConfig.assetRoot,`/official/${entry.set}`);
    assert.equal(model.sceneConfig.instancesUrl,`/official/${entry.set}/instances.json`);
    const inventory=JSON.parse(readFileSync(new URL(`official/${entry.set}/model-inventory.json`,root),'utf8'));
    assert.equal(inventory.reduce((sum,part)=>sum+part.quantity,0),model.modeledPieceCount);
    const provenance=JSON.parse(readFileSync(new URL(`official/${entry.set}/model-provenance.json`,root),'utf8'));
    assert.equal(model.sourceUrl,provenance.modelSource);
    assert.equal(model.booklets.length,entry.books);
    for(const book of model.booklets){
      assert.deepEqual(Object.keys(book).sort(),['sourceUrl','title']);
      const url=new URL(book.sourceUrl);
      assert.equal(url.origin,'https://www.lego.com');
      assert.match(url.pathname,/^\/cdn\/product-assets\/product\.bi\.core\.pdf\/\d+\.pdf$/);
    }
    assert.ok(model.scope.length>40);
  }
  assert.equal(getModel().alias,'porsche');
  assert.equal(getModel('not-a-published-model'),undefined);
});

test('downloadable inventories contain model geometry counts and attribution only',()=>{
  for(const model of listModels()){
    const text=readFileSync(new URL(`model-${model.setNumber}-inventory.csv`,root),'utf8');
    const rows=text.trimEnd().split(/\r?\n/).map(line=>{
      assert.match(line,/^"(?:[^"]|"")*"(?:,"(?:[^"]|"")*")*$/);
      return [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(match=>match[1].replaceAll('""','"'));
    });
    assert.deepEqual(rows.shift(),['LDraw part filename','LDraw color code','Modeled quantity','Model author','Model and library credits']);
    const inventory=JSON.parse(readFileSync(new URL(`official/${model.setNumber}/model-inventory.json`,root),'utf8'));
    assert.equal(rows.length,inventory.length);
    assert.equal(rows.reduce((sum,row)=>sum+Number(row[2]),0),model.modeledPieceCount);
    const expected=new Map(inventory.map(row=>[`${row.partFile}:${row.ldrawColor}`,row.quantity]));
    for(const row of rows){
      assert.equal(row.length,5);
      const key=`${row[0]}:${row[1]}`;
      assert.equal(Number(row[2]),expected.get(key));
      assert.ok(expected.delete(key));
      assert.equal(row[3],model.author);
      assert.equal(row[4],`https://johnson-lee-v0.github.io/LEGO-Collection/official/${model.setNumber}/MODEL-CREDITS.md`);
    }
    assert.equal(expected.size,0);
  }
});

test('distributed dependency notices retain full installed licenses and separate attributions',()=>{
  const notices=readFileSync(new URL('THIRD-PARTY-NOTICES.txt',root),'utf8');
  for(const name of ['three','lucide']){
    const license=readFileSync(new URL(`../node_modules/${name}/LICENSE`,import.meta.url),'utf8').trim();
    assert.ok(notices.includes(license),`${name} copyright and complete permission notice`);
  }
  assert.match(notices,/Three\.js 0\.180\.0/);
  assert.match(notices,/Lucide 0\.468\.0/);
  assert.match(notices,/Copyright \(c\) 2013-2017 Cole Bemis/);
  assert.match(notices,/Vite 6\.3\.6/);
  assert.match(notices,/Copyright \(C\) 2018-2021 Guy Bedford/);
  assert.match(notices,/Copyright \(c\) 2019-present, VoidZero Inc\. and Vite contributors/);
  assert.equal((notices.match(/Permission is hereby granted, free of charge/g)||[]).length,4);
  assert.match(notices,/LDraw models and parts/);
});

test('viewer source has no legacy service calls, telemetry or external font loads',()=>{
  const sourceRoot=new URL('../src/',import.meta.url);
  const sourceFiles=files(sourceRoot).filter(name=>/\.(?:js|css)$/.test(name));
  for(const name of sourceFiles){
    const text=readFileSync(new URL(name,sourceRoot),'utf8');
    assert.doesNotMatch(text,/\/api\/|\bapiFetch\b|\bcreateProgressStore\b|\bcollection-progress\b/,name);
    assert.doesNotMatch(text,/\bsendBeacon\s*\(|\b(?:XMLHttpRequest|WebSocket|EventSource)\s*\(/,name);
    assert.doesNotMatch(text,/\b(?:gtag|ga|fbq)\s*\(|google-analytics\.com|googletagmanager\.com|plausible\.io|api\.segment\.io/,name);
    assert.doesNotMatch(text,/\bfetch\s*\(\s*['"`](?:https?:)?\/\//,name);
    assert.doesNotMatch(text,/fonts\.(?:googleapis|gstatic)\.com/,name);
    if(name.endsWith('.css')){
      assert.doesNotMatch(text,/@import\b/,name);
      assert.doesNotMatch(text,/url\(\s*['"]?(?:https?:)?\/\//,name);
    }
  }
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/<(?:script|link|iframe|img)\b[^>]*(?:src|href)\s*=\s*['"](?:https?:)?\/\//i);
});
