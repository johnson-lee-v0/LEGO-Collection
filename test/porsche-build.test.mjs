import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PORSCHE_BUILD } from '../src/porsche-build-steps.js';
import { PORSCHE_STEP_PARTS } from '../src/porsche-step-parts.js';
import { PORSCHE_ELEMENT_MAP } from '../src/porsche-element-map.js';

const instances = JSON.parse(readFileSync(new URL('../public/official/10295/instances.json', import.meta.url)));
const byId = new Map(instances.map(part => [part.id, part]));
const readPublic = name => JSON.parse(readFileSync(new URL(`../public/official/10295/${name}`, import.meta.url)));
const allows = (row, part) => {
  const files = row.sourcePartFiles || [row.partFile];
  const colors = row.sourceLdrawColors || [row.ldrawColor];
  return files.some(file => [part.partFile, part.catalogPartFile].includes(file)) && colors.includes(part.ldrawColor);
};

test('Every physical Porsche instance appears once in the complete 366-step build', () => {
  assert.equal(PORSCHE_BUILD.steps.length, 366);
  const ids = PORSCHE_BUILD.steps.flatMap(step => step.partIds);
  assert.equal(ids.length, 1363);
  assert.equal(new Set(ids).size, 1363);
  assert.deepEqual(new Set(ids), new Set(byId.keys()));
  assert.deepEqual(PORSCHE_BUILD.steps.map(step => step.id), PORSCHE_STEP_PARTS.steps.map(step => step.id));
  for (let index = 0; index < 366; index++) {
    const mapped = PORSCHE_BUILD.steps[index];
    const official = PORSCHE_STEP_PARTS.steps[index];
    assert.equal(mapped.quantity, official.quantity, mapped.id);
    assert.equal(mapped.partIds.length, official.quantity, mapped.id);
    assert.deepEqual(mapped.parts, official.parts.map(part => ({ elementId: part.elementId, quantity: part.quantity })), mapped.id);
  }
});

test('Each numbered batch matches the official part and color identities', () => {
  for (const step of PORSCHE_BUILD.steps) {
    const expected = step.parts.flatMap(row => Array.from({ length: row.quantity }, () => PORSCHE_ELEMENT_MAP[row.elementId]));
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

test('No-new-piece actions refer only to previously built pieces', () => {
  const added = new Set();
  let actions = 0;
  for (const step of PORSCHE_BUILD.steps) {
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
  assert.equal(actions, 25);
});

test('Verified Porsche source corrections and anchors keep their official batches', () => {
  const corrections = readPublic('model-provenance.json').officialGeometryCorrections;
  assert.equal(corrections.additions.length, 2);
  assert.equal(corrections.removals.length, 1);
  assert.equal(corrections.replacements.length, 10);
  for (const correction of corrections.additions) {
    const matching = instances.filter(part => part.partFile === correction.partFile && part.ldrawColor === correction.ldrawColor && JSON.stringify(part.position) === JSON.stringify(correction.position));
    assert.equal(matching.length, 1, 'Each documented addition has one physical instance');
    assert.ok(PORSCHE_BUILD.steps[correction.step - 1].partIds.includes(matching[0].id));
  }
  assert.ok(!byId.has('porsche-part-0439'));
  const anchored = instances.filter(part => part.officialStepAnchor);
  assert.ok(anchored.length >= 15);
  for (const part of anchored) {
    assert.ok(PORSCHE_BUILD.steps[part.officialStepAnchor - 1].partIds.includes(part.id), `${part.id} must be placed at its verified step ${part.officialStepAnchor}`);
  }
  assert.equal(byId.get('porsche-part-1027').ldrawColor, 71);
  assert.equal(byId.get('porsche-part-1037').ldrawColor, 71);
  assert.equal(byId.get('porsche-part-0723').ldrawColor, 15);
  assert.equal(byId.get('porsche-part-0727').ldrawColor, 15);
  assert.equal(byId.get('porsche-part-1139').partFile, '87552p02.dat');
  assert.equal(byId.get('porsche-part-1149').partFile, '87552p01.dat');
});
