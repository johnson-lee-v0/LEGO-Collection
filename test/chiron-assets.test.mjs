import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { Box3, Vector3 } from 'three';
import { bindAssemblyInstances } from '../src/assembly-assembly.js';

const root = new URL('../public/official/42083/', import.meta.url);
const json = async file => JSON.parse(await readFile(new URL(file,root),'utf8'));

test('Chiron has 3,590 distinct physical instances including four complete universal joints',async()=>{
  const instances = await json('instances.json');
  const inventory = await json('model-inventory.json');
  assert.equal(instances.length,3590);
  assert.equal(new Set(instances.map(p=>p.id)).size,3590);
  assert.equal(inventory.reduce((sum,p)=>sum+p.quantity,0),3590);
  const joints=instances.filter(p=>p.catalogPartFile==='61903.dat');
  assert.equal(joints.length,4);
  assert.ok(joints.every(p=>p.physicalAssembly));
  assert.equal(instances.filter(p=>p.flexibleAssembly).length,27);
  for(const part of instances){
    assert.equal(part.position.length,3);
    assert.equal(part.matrix.length,9);
    assert.ok([...part.position,...part.matrix].every(Number.isFinite));
  }
  const structure=await json('source-structure.json');
  assert.equal(structure.assemblies[0].instanceIds.length,3590);
  const leaves=structure.groups.flatMap(g=>g.entries.filter(e=>e.instanceId).map(e=>e.instanceId));
  assert.deepEqual(leaves.slice().sort(),instances.map(p=>p.id).sort());
});

test('Chiron retains its attributed redistributed source and has no unresolved library files',async()=>{
  const provenance=await json('model-provenance.json');
  const source=await readFile(new URL('source-model.mpd',root));
  assert.equal(createHash('sha256').update(source).digest('hex'),provenance.distributedSourceSha256);
  assert.match(source.toString(),/Author: Philippe Hurbain \[Philo\]/);
  assert.match(source.toString(),/Redistributable under CCAL version 2.0/);
  const manifest=await json('ldraw-manifest.json');
  assert.deepEqual(manifest.missing,[]);
});

test('Chiron omits the separately licensed snapping metadata without changing geometry',async()=>{
  const provenance=await json('model-provenance.json');
  const baselineHashes={
    'source-model.mpd':'746a77bea48bca14e9b43b892ef41910e488b7bfb9fec99e494da9eb7c17fb71',
    'model.mpd':'2b92a9e73e245bf1bce4e41c4d15c5189f7b142b8e845069963ab0d495a052aa',
  };
  assert.deepEqual(provenance.omittedMetadata.geometryLineSha256,baselineHashes);
  assert.equal(provenance.distributedSourceSha256,'211c43bdf56742a47900644c73dc5b3b21ee98ba2a12f3a36e775b4367519c07');
  assert.notEqual(provenance.distributedSourceSha256,provenance.sourceSha256);
  for(const [file,expectedHash] of Object.entries(baselineHashes)){
    const text=await readFile(new URL(file,root),'utf8');
    const geometry=text.split(/\r?\n/).filter(line=>/^[1-5]\s/.test(line)).join('\n');
    assert.equal(createHash('sha256').update(geometry).digest('hex'),expectedHash,file);
    assert.doesNotMatch(text,/^0\s+!LDCAD\s+SNAP_/im,file);
    assert.doesNotMatch(text,/non[ -]?commercial/i,file);
    assert.doesNotMatch(text,/^0\s+Author:\s+Roland Melkert/im,file);
    assert.match(text,/Author: Philippe Hurbain \[Philo\]/);
    assert.match(text,/Redistributable under CCAL version 2\.0/);
  }
});

test('Chiron packed CAD binds all 3,590 instances without network requests',async()=>{
  const text=await readFile(new URL('model.mpd',root),'utf8');
  const config=await readFile(new URL('ldraw/LDConfig.ldr',root),'utf8');
  const loader=new LDrawLoader();
  loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
  const firstBreak=text.indexOf('\n');
  const packed=text.slice(0,firstBreak+1)+config+'\n'+text.slice(firstBreak+1);
  const oldFetch=globalThis.fetch,oldWarn=console.warn;
  const missing=[],warnings=[];
  globalThis.fetch=async resource=>{missing.push(String(resource?.url||resource));throw new Error('Unpacked dependency');};
  console.warn=(...args)=>warnings.push(args.join(' '));
  try{
    const group=await new Promise((resolve,reject)=>loader.parse(packed,resolve,reject));
    const instances=await json('instances.json');
    const bound=bindAssemblyInstances(group,instances);
    assert.equal(bound.size,3590);
    assert.equal(new Set(bound.values()).size,3590);
    for(const instance of instances){
      const node=bound.get(instance.id);
      assert.ok(node.getWorldPosition(new Vector3()).distanceTo(new Vector3(...instance.position))<.08);
      let meshes=0;node.traverse(child=>{if(child.isMesh)meshes++});assert.ok(meshes>0);
    }
    const bounds=new Box3().setFromObject(group);
    assert.ok(!bounds.isEmpty());
    assert.ok(bounds.getSize(new Vector3()).toArray().every(n=>Number.isFinite(n)&&n>0));
    assert.deepEqual(missing,[]);
    assert.deepEqual(warnings,[]);
  }finally{globalThis.fetch=oldFetch;console.warn=oldWarn;}
});
