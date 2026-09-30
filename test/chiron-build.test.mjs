import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHIRON_BUILD } from '../src/chiron-build-steps.js';
import { CHIRON_STEP_PARTS } from '../src/chiron-step-parts.js';
import { CHIRON_ELEMENT_MAP } from '../src/chiron-element-map.js';

const instances = JSON.parse(readFileSync(new URL('../public/official/42083/instances.json', import.meta.url)));
const byId = new Map(instances.map(part => [part.id, part]));
const readPublic = name => JSON.parse(readFileSync(new URL(`../public/official/42083/${name}`, import.meta.url)));
const allows = (row, part) => {
  const files = row.sourcePartFiles || [row.partFile];
  const colors = row.sourceLdrawColors || [row.ldrawColor];
  return files.some(file => [part.partFile, part.catalogPartFile].includes(file)) && colors.includes(part.ldrawColor);
};

test('Every physical Chiron instance appears once in the complete 970-step build', () => {
  assert.equal(CHIRON_BUILD.steps.length, 970);
  const ids = CHIRON_BUILD.steps.flatMap(step => step.partIds);
  assert.equal(ids.length, 3590);
  assert.equal(new Set(ids).size, 3590);
  assert.deepEqual(new Set(ids), new Set(byId.keys()));
  assert.deepEqual(CHIRON_BUILD.steps.map(step => step.id), CHIRON_STEP_PARTS.steps.map(step => step.id));
  for (let index = 0; index < 970; index++) {
    const mapped = CHIRON_BUILD.steps[index];
    const official = CHIRON_STEP_PARTS.steps[index];
    assert.equal(mapped.quantity, official.quantity, mapped.id);
    assert.equal(mapped.partIds.length, official.quantity, mapped.id);
    assert.deepEqual(mapped.parts, official.parts.map(part => ({ elementId: part.elementId, quantity: part.quantity })), mapped.id);
  }
});

test('Each numbered batch matches the official part and color identities', () => {
  for (const step of CHIRON_BUILD.steps) {
    const expected = step.parts.flatMap(row => Array.from({ length: row.quantity }, () => CHIRON_ELEMENT_MAP[row.elementId]));
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
    [26, 40, [assembly('root/7/7/101/44'), assembly('root/7/7/101/45')]],
    [162, 169, [assembly('root/7/7/183/99'), assembly('root/7/7/183/100')]],
    [233, 237, [assembly('root/7/9/89'), assembly('root/7/9/90')]],
  ];
  for (const [first, last, copies] of pools) {
    for (let number = first; number <= last; number++) {
      const step = CHIRON_BUILD.steps[number-1];
      const perCopy = CHIRON_STEP_PARTS.steps[number-1].parts.reduce((sum, row) => sum + row.printedQuantity, 0);
      for (const copy of copies) assert.equal(step.partIds.filter(id => copy.has(id)).length, perCopy, `Step ${number} keeps each repeated copy distinct`);
    }
  }
});

test('No-new-piece actions refer only to previously built pieces', () => {
  const added = new Set();
  let actions = 0;
  for (const step of CHIRON_BUILD.steps) {
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
  assert.equal(actions, 99);
});

test('Verified Chiron geometry repairs remain at their source-checked steps', () => {
  const corrected = readPublic('model-provenance.json').officialGeometryCorrections.additions;
  assert.equal(corrected.length, 23);
  for (const part of corrected) {
    assert.ok(CHIRON_BUILD.steps[part.step - 1].partIds.includes(part.id), `${part.id} must retain step ${part.step}`);
  }
  assert.ok(!byId.has('chiron-part-2365'));
  assert.ok(!byId.has('chiron-part-2391'));
});

test('All explicit Chiron placement anchors override duplicate-piece source order', () => {
  const anchored = instances.filter(part => part.officialStepAnchor);
  assert.equal(anchored.length, 25);
  for (const part of anchored) {
    assert.ok(CHIRON_BUILD.steps[part.officialStepAnchor - 1].partIds.includes(part.id), `${part.id} must be placed at verified step ${part.officialStepAnchor}`);
  }
  assert.ok(CHIRON_BUILD.steps[66].partIds.includes('chiron-part-0320'));
  assert.ok(CHIRON_BUILD.steps[67].partIds.includes('chiron-part-0313'));
});
