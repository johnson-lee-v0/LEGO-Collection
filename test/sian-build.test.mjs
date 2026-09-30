import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SIAN_BUILD } from '../src/sian-build-steps.js';
import { SIAN_STEP_PARTS } from '../src/sian-step-parts.js';
import { SIAN_ELEMENT_MAP } from '../src/sian-element-map.js';

const instances = JSON.parse(readFileSync(new URL('../public/official/42115/instances.json', import.meta.url)));
const byId = new Map(instances.map(part => [part.id, part]));
const readPublic = name => JSON.parse(readFileSync(new URL(`../public/official/42115/${name}`, import.meta.url)));
const allows = (row, part) => {
  const files = row.sourcePartFiles || [row.partFile];
  const colors = row.sourceLdrawColors || [row.ldrawColor];
  return files.some(file => [part.partFile, part.catalogPartFile].includes(file)) && colors.includes(part.ldrawColor);
};

test('Every physical Sián instance appears once in the complete 1084-step build', () => {
  assert.equal(SIAN_BUILD.steps.length, 1084);
  const ids = SIAN_BUILD.steps.flatMap(step => step.partIds);
  assert.equal(ids.length, 3696);
  assert.equal(new Set(ids).size, 3696);
  assert.deepEqual(new Set(ids), new Set(byId.keys()));
  assert.deepEqual(SIAN_BUILD.steps.map(step => step.id), SIAN_STEP_PARTS.steps.map(step => step.id));
  for (let index = 0; index < 1084; index++) {
    const mapped = SIAN_BUILD.steps[index];
    const official = SIAN_STEP_PARTS.steps[index];
    assert.equal(mapped.quantity, official.quantity, mapped.id);
    assert.equal(mapped.partIds.length, official.quantity, mapped.id);
    assert.deepEqual(mapped.parts, official.parts.map(part => ({ elementId: part.elementId, quantity: part.quantity })), mapped.id);
  }
});

test('Each numbered batch matches the official part and color identities', () => {
  for (const step of SIAN_BUILD.steps) {
    const expected = step.parts.flatMap(row => Array.from({ length: row.quantity }, () => SIAN_ELEMENT_MAP[row.elementId]));
    const parts = step.partIds.map(id => byId.get(id));
    // Match the whole batch, including printed/base and mold aliases, without
    // allowing one CAD instance to satisfy more than one official callout.
    const assigned = Array(parts.length).fill(-1);
    function place(index, seen) {
      for (let candidate = 0; candidate < parts.length; candidate++) {
        if (seen.has(candidate) || !allows(expected[index], parts[candidate])) continue;
        seen.add(candidate);
        if (assigned[candidate] < 0 || place(assigned[candidate], seen)) {
          assigned[candidate] = index;
          return true;
        }
      }
      return false;
    }
    for (let index = 0; index < expected.length; index++) {
      assert.ok(place(index, new Set()), `${step.id}: ${expected[index]?.elementId} has no unique matching CAD instance`);
    }
  }
});

test('Repeated subassemblies consume both distinct copies at each official step', () => {
  const structure = readPublic('source-structure.json');
  const assembly = id => new Set(structure.assemblies.find(row => row.id === id).instanceIds);
  const pools = [
    [147, 149, [new Set(Array.from({length:8}, (_, i) => `sian-part-${String(486+i).padStart(4,'0')}`)), new Set(Array.from({length:8}, (_, i) => `sian-part-${String(494+i).padStart(4,'0')}`))]],
    [183, 186, [assembly('root/338'), assembly('root/339')]],
    [583, 590, [assembly('root/793'), assembly('root/794')]],
  ];
  for (const [first, last, copies] of pools) {
    for (let number = first; number <= last; number++) {
      const step = SIAN_BUILD.steps[number-1];
      const perCopy = SIAN_STEP_PARTS.steps[number-1].parts.reduce((sum, row) => sum + row.printedQuantity, 0);
      for (const copy of copies) assert.equal(step.partIds.filter(id => copy.has(id)).length, perCopy, `Step ${number} keeps each repeated copy distinct`);
    }
  }
});

test('No-new-piece actions refer only to previously built pieces', () => {
  const added = new Set();
  let actions = 0;
  for (const step of SIAN_BUILD.steps) {
    if (!step.partIds.length) {
      actions++;
      assert.ok(step.action?.instanceIds?.length, `${step.id} must identify the existing assembly`);
      for (const id of step.action.instanceIds) assert.ok(added.has(id), `${step.id} handles future or missing part ${id}`);
      if (step.action.kind === 'attach-subassembly') {
        assert.ok(step.action.verified || /visually reviewed/i.test(step.action.verification || ''), `${step.id} must not present an inferred join as a verified attachment`);
      }
    }
    for (const id of step.partIds) added.add(id);
  }
  assert.equal(actions, 115);
});

test('Source corrections retain four modern mudguards and four anchored missing pins', () => {
  const provenance = readPublic('model-provenance.json');
  const corrections = provenance.officialGeometryCorrections;
  for (const id of corrections.mudguardReplacement.instanceIds) assert.equal(byId.get(id).partFile, '67141.dat');
  for (const part of corrections.parts) {
    const mapped = SIAN_BUILD.steps[part.step - 1];
    assert.ok(mapped.partIds.includes(part.id), `${part.id} must be added at its visually checked official step ${part.step}`);
    assert.deepEqual(byId.get(part.id).position, part.position);
  }
  assert.equal(corrections.parts.length, 4);
});

test('All fourteen liftarm display-color changes retain their source and official identity', () => {
  assert.equal(SIAN_BUILD.colorOverrides.length, 14);
  assert.equal(new Set(SIAN_BUILD.colorOverrides.map(row => row.id)).size, 14);
  for (const correction of SIAN_BUILD.colorOverrides) {
    const part = byId.get(correction.id);
    assert.equal(part.partFile, '11478.dat');
    assert.equal(part.ldrawColor, 71);
    assert.equal(correction.from, 71);
    assert.equal(correction.to, 0);
    assert.equal(correction.elementId, '6030286');
    const batch = SIAN_BUILD.steps.find(step => step.id === correction.stepId);
    assert.ok(batch.partIds.includes(correction.id));
    assert.ok(batch.parts.some(row => row.elementId === correction.elementId));
  }
});
