import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHIRON_INVENTORY } from '../src/chiron-inventory.js';
import { CHIRON_ELEMENT_MAP } from '../src/chiron-element-map.js';

const assetRoot = new URL('../public/official/42083/', import.meta.url);
const readJson = async name => JSON.parse(await readFile(new URL(name, assetRoot), 'utf8'));
const sortedEntries = map => [...map].sort(([a], [b]) => a.localeCompare(b));
const increment = (map, key, count = 1) => map.set(key, (map.get(key) || 0) + count);

test('Chiron preserves the 308 printed inventory rows and the published-count discrepancy', () => {
  const inventory = CHIRON_INVENTORY;
  assert.equal(inventory.namespace, 'LEGO element ID');
  assert.equal(inventory.bookletId, '6257444');
  assert.equal(inventory.rowCount, 308);
  assert.equal(inventory.rows.length, 308);
  assert.equal(new Set(inventory.rows.map(row => row.elementId)).size, 308);
  assert.equal(inventory.quantityTotal, 3598);
  assert.equal(inventory.rows.reduce((sum, row) => sum + row.quantity, 0), 3598);
  assert.equal(inventory.publishedPieceCount, 3599);
  assert.equal(inventory.reconciliation.status, 'unreconciled');
  assert.equal(inventory.reconciliation.differenceFromPublished, 1);
  assert.deepEqual(inventory.pageTotals, [
    { page: 316, rowCount: 99, quantityTotal: 2182 },
    { page: 317, rowCount: 63, quantityTotal: 430 },
    { page: 318, rowCount: 77, quantityTotal: 726 },
    { page: 319, rowCount: 69, quantityTotal: 260 },
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


test('All corrected Chiron instances map uniquely to the official element catalog', async () => {
  const [instances, crosswalk] = await Promise.all([
    readJson('instances.json'), readJson('element-crosswalk.json'),
  ]);
  assert.equal(instances.length, 3590);
  assert.equal(Object.keys(CHIRON_ELEMENT_MAP).length, 308);
  assert.deepEqual(crosswalk.rows, CHIRON_ELEMENT_MAP);
  assert.deepEqual(crosswalk.reconciliation.unmappedInstances, []);
  assert.deepEqual(crosswalk.reconciliation.ambiguousInstances, []);
  assert.equal(Object.keys(crosswalk.sourceInstanceCanonicalKeys).length, instances.length);
  const index = new Map();
  for (const row of CHIRON_INVENTORY.rows) {
    const mapped = CHIRON_ELEMENT_MAP[row.elementId];
    assert.ok(mapped, `Missing element ${row.elementId}`);
    assert.equal(mapped.elementId, row.elementId);
    assert.ok(mapped.catalogPart && mapped.catalogName && mapped.colorName);
    assert.notEqual(mapped.status, 'unresolved', row.elementId);
    assert.ok(mapped.sourcePartFiles.length > 0, row.elementId);
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

test('Chiron CAD and numbered callouts have identical part/color totals; eight printed items remain explicit', async () => {
  const [instances, crosswalk, callouts] = await Promise.all([
    readJson('instances.json'), readJson('element-crosswalk.json'), readJson('step-parts.json'),
  ]);
  const source = new Map(), steps = new Map(), printed = new Map();
  for (const instance of instances) increment(source, crosswalk.sourceInstanceCanonicalKeys[instance.id]);
  for (const step of callouts.steps) {
    for (const part of step.parts) increment(steps, CHIRON_ELEMENT_MAP[part.elementId].canonicalKey, part.quantity);
  }
  for (const row of CHIRON_INVENTORY.rows) increment(printed, CHIRON_ELEMENT_MAP[row.elementId].canonicalKey, row.quantity);
  assert.equal([...steps.values()].reduce((a, b) => a + b, 0), 3590);
  assert.deepEqual(sortedEntries(source), sortedEntries(steps));
  const difference = new Map();
  for (const [key, quantity] of printed) {
    const missing = quantity - (source.get(key) || 0);
    if (missing) difference.set(key, missing);
  }
  assert.deepEqual(sortedEntries(difference), [['2780:0', 7], ['85546:14', 1]]);
  assert.deepEqual(crosswalk.reconciliation.differences, [
    { canonicalKey: '2780:0', officialQuantity: 684, sourceQuantity: 677, sourceMinusOfficial: -7 },
    { canonicalKey: '85546:14', officialQuantity: 2, sourceQuantity: 1, sourceMinusOfficial: -1 },
  ]);
});
