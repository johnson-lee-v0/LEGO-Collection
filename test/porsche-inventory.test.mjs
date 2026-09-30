import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PORSCHE_INVENTORY } from '../src/porsche-inventory.js';
import { PORSCHE_ELEMENT_MAP } from '../src/porsche-element-map.js';

const assetRoot = new URL('../public/official/10295/', import.meta.url);
const readJson = async name => JSON.parse(await readFile(new URL(name, assetRoot), 'utf8'));
const sortedEntries = map => [...map].sort(([a], [b]) => a.localeCompare(b));
const increment = (map, key, count = 1) => map.set(key, (map.get(key) || 0) + count);

test('Porsche preserves the 382 printed inventory rows and matches the published box quantity', () => {
  const inventory = PORSCHE_INVENTORY;
  assert.equal(inventory.namespace, 'LEGO element ID');
  assert.equal(inventory.bookletId, '6379206');
  assert.equal(inventory.rowCount, 382);
  assert.equal(inventory.rows.length, 382);
  assert.equal(new Set(inventory.rows.map(row => row.elementId)).size, 382);
  assert.equal(inventory.quantityTotal, 1458);
  assert.equal(inventory.rows.reduce((sum, row) => sum + row.quantity, 0), 1458);
  assert.equal(inventory.publishedPieceCount, 1458);
  assert.equal(inventory.reconciliation.status, 'matched');
  assert.equal(inventory.reconciliation.differenceFromPublished, 0);
  assert.match(inventory.inventoryScope, /Turbo and Targa/);
  assert.deepEqual(inventory.pageTotals, [
    { page: 265, rowCount: 146, quantityTotal: 645 },
    { page: 266, rowCount: 120, quantityTotal: 402 },
    { page: 267, rowCount: 116, quantityTotal: 411 },
  ]);
  for (const row of inventory.rows) {
    assert.match(row.elementId, /^\d+$/);
    assert.ok(Number.isInteger(row.quantity) && row.quantity > 0);
    assert.equal(row.bookletId, inventory.bookletId);
    assert.ok(inventory.sourcePages.includes(row.page));
    assert.equal(row.sourceBoundsPt.length, 4);
    assert.ok(row.sourceBoundsPt.every(Number.isFinite));
    assert.ok(row.sourceBoundsPt[2] > row.sourceBoundsPt[0]);
    assert.ok(row.sourceBoundsPt[3] > row.sourceBoundsPt[1]);
    assert.ok(row.sourceImageObject);
  }
});


test('Every printed Porsche element has a verified catalog identity and a preserved source record', async () => {
  const crosswalk = await readJson('element-crosswalk.json');
  assert.equal(Object.keys(PORSCHE_ELEMENT_MAP).length, 382);
  assert.deepEqual(crosswalk.rows, PORSCHE_ELEMENT_MAP);
  assert.match(crosswalk.inventoryScope, /Turbo assembled quantities are a subset/);
  for (const row of PORSCHE_INVENTORY.rows) {
    const mapped = PORSCHE_ELEMENT_MAP[row.elementId];
    assert.ok(mapped, `Missing element ${row.elementId}`);
    assert.equal(mapped.elementId, row.elementId);
    assert.ok(mapped.catalogPart && mapped.catalogName && mapped.colorName);
    assert.ok(Number.isInteger(mapped.ldrawColor));
    assert.equal(mapped.canonicalKey, `${mapped.canonicalPart}:${mapped.catalogColor}`);
  }
  assert.equal(PORSCHE_INVENTORY.rows.find(row => row.elementId === '6240515').quantity, 1,
    'The box inventory includes its brick separator even though it is not assembled into the car');
});

test('All corrected Porsche instances map uniquely to the official element catalog', async () => {
  const [instances, crosswalk] = await Promise.all([
    readJson('instances.json'), readJson('element-crosswalk.json'),
  ]);
  assert.equal(instances.length, 1363);
  assert.equal(Object.keys(PORSCHE_ELEMENT_MAP).length, 382);
  assert.deepEqual(crosswalk.rows, PORSCHE_ELEMENT_MAP);
  assert.deepEqual(crosswalk.reconciliation.unmappedInstances, []);
  assert.deepEqual(crosswalk.reconciliation.ambiguousInstances, []);
  assert.equal(Object.keys(crosswalk.sourceInstanceCanonicalKeys).length, instances.length);
  const index = new Map();
  for (const row of PORSCHE_INVENTORY.rows) {
    const mapped = PORSCHE_ELEMENT_MAP[row.elementId];
    assert.ok(mapped, `Missing element ${row.elementId}`);
    assert.equal(mapped.elementId, row.elementId);
    assert.ok(mapped.catalogPart && mapped.catalogName && mapped.colorName);
    for (const file of mapped.sourcePartFiles) {
      for (const color of mapped.sourceLdrawColors) {
        const key = `${file}:${color}`;
        if (!index.has(key)) index.set(key, new Set());
        index.get(key).add(mapped.canonicalKey);
      }
    }
  }
  for (const instance of instances) {
    const keys = index.get(`${instance.partFile}:${instance.ldrawColor}`)
      || index.get(`${instance.catalogPartFile}:${instance.ldrawColor}`);
    assert.equal(keys?.size, 1, `Ambiguous or missing source alias ${instance.id}`);
    assert.equal(crosswalk.sourceInstanceCanonicalKeys[instance.id], [...keys][0]);
  }
});

test('Porsche Turbo uses exactly its official 1,363 pieces and retains 95 unused box pieces', async () => {
  const [instances, crosswalk, callouts] = await Promise.all([
    readJson('instances.json'), readJson('element-crosswalk.json'), readJson('step-parts.json'),
  ]);
  const source = new Map(), stepKeys = new Map(), usedElements = new Map();
  for (const instance of instances) increment(source, crosswalk.sourceInstanceCanonicalKeys[instance.id]);
  for (const step of callouts.steps) {
    for (const part of step.parts) {
      increment(stepKeys, PORSCHE_ELEMENT_MAP[part.elementId].canonicalKey, part.quantity);
      increment(usedElements, part.elementId, part.quantity);
    }
  }
  assert.equal([...stepKeys.values()].reduce((a, b) => a + b, 0), 1363);
  assert.deepEqual(sortedEntries(source), sortedEntries(stepKeys));
  const usage = crosswalk.instructionUsage;
  assert.equal(usage.variant, 'Turbo');
  assert.equal(usage.instructionQuantity, 1363);
  assert.equal(usage.unusedBoxQuantity, 95);
  assert.deepEqual(usage.sourceDifferences, []);
  assert.equal(usage.rows.length, 382);
  let unused = 0;
  for (const inventoryRow of PORSCHE_INVENTORY.rows) {
    const row = usage.rows.find(item => item.elementId === inventoryRow.elementId);
    assert.ok(row, inventoryRow.elementId);
    assert.equal(row.printedQuantity, inventoryRow.quantity);
    assert.equal(row.turboQuantity, usedElements.get(row.elementId) || 0);
    assert.equal(row.unusedQuantity, row.printedQuantity - row.turboQuantity);
    assert.ok(row.unusedQuantity >= 0, `Turbo exceeds the box for ${row.elementId}`);
    unused += row.unusedQuantity;
  }
  assert.equal(unused, 95);
  for (const elementId of ['6240515', '6342998', '6349278', '6342997']) {
    assert.equal(usedElements.get(elementId) || 0, 0,
      'The separator, Targa badge and unused license-plate choices stay outside the Turbo model');
  }
  assert.equal(usedElements.get('6342999'), 1, 'The Turbo badge is used');
  assert.equal(usedElements.get('6343015'), 2, 'The selected model uses both German license plates');
});

test('Porsche corrections retain the two pin rows, gray headlight rods and distinct printed windows', async () => {
  const instances = await readJson('instances.json');
  const byId = new Map(instances.map(part => [part.id, part]));
  for (const id of ['porsche-part-1027', 'porsche-part-1037']) {
    assert.equal(byId.get(id).ldrawColor, 71);
    assert.equal(byId.get(id).officialStepAnchor, 292);
    assert.ok(byId.get(id).sourceCorrection);
  }
  assert.equal(byId.get('porsche-part-1100').ldrawColor, 15, 'The separate Turbo charger bar remains White');
  assert.equal(byId.get('porsche-part-1139').partFile, '87552p02.dat');
  assert.equal(byId.get('porsche-part-1149').partFile, '87552p01.dat');
  const pins = instances.filter(part => part.partFile === '10295 - 65304.dat' && part.ldrawColor === 25);
  assert.equal(pins.length, 8);
  const step175 = pins.filter(part => part.officialStepAnchor === 175);
  const step176 = pins.filter(part => part.officialStepAnchor === 176);
  assert.equal(step175.length, 2);
  assert.equal(step176.length, 4);
  assert.ok(step175.every(part => part.position[1] === -42));
  assert.ok(step176.every(part => part.position[1] === -82));
  for (const id of ['porsche-part-0632', 'porsche-part-0633']) {
    assert.equal(byId.get(id).position[1], -82);
    assert.equal(byId.get(id).officialStepAnchor, 176);
  }
});
