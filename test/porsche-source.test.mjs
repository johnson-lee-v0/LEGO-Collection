import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PORSCHE_INSTRUCTIONS } from '../src/porsche-instructions.js';
import { PORSCHE_INVENTORY } from '../src/porsche-inventory.js';
import { PORSCHE_STEP_PARTS } from '../src/porsche-step-parts.js';
import { PORSCHE_STEP_ACTIONS } from '../src/porsche-step-actions.js';

const publicRoot = new URL('../public/', import.meta.url);
const step = number => PORSCHE_STEP_PARTS.steps[number - 1];

test('Porsche progress selects the common base and Turbo branch while retaining official numbering', () => {
  const source = PORSCHE_INSTRUCTIONS;
  assert.equal(source.stepCount, 366);
  assert.equal(source.variant, 'Turbo');
  assert.deepEqual(source.booklets.map(book => [book.id, book.pageCount]), [['6379206', 268]]);
  assert.deepEqual(source.steps.map(row => row.number), Array.from({ length: 366 }, (_, index) => index + 1));
  assert.equal(new Set(source.steps.map(row => row.id)).size, 366);
  for (const [branch, count, offset, firstPage, lastPage] of [['base', 305, 0, 10, 180], ['turbo', 61, 305, 183, 229]]) {
    const steps = source.steps.filter(row => row.branch === branch);
    assert.equal(steps.length, count);
    steps.forEach((row, index) => {
      assert.equal(row.number, offset + index + 1);
      assert.equal(row.officialNumber, index + 1);
      assert.equal(row.id, `porsche-${branch}-${index + 1}`);
      assert.equal(row.officialLabel, `${branch === 'base' ? 'Base' : 'Turbo'} ${index + 1}`);
      assert.ok(row.pages.every(page => page >= firstPage && page <= lastPage));
    });
  }
  assert.deepEqual(source.branchSelection.selected.officialSteps, [1, 61]);
  assert.equal(source.branchSelection.excluded.name, 'Targa');
  assert.equal(source.steps[304].id, 'porsche-base-305');
  assert.equal(source.steps[305].id, 'porsche-turbo-1');
});

test('Every Porsche instruction step points to the original verified booklet', () => {
  const book = PORSCHE_INSTRUCTIONS.booklets[0];
  assert.equal(book.sourceSha256, 'c085fc532a7de797b4cd44fd06a96810bebae589c003247f0706832120a85c46');
  for (let page = 1; page <= book.pageCount; page++) {
      assert.match(book.sourceUrl, /^https:\/\/www\.lego\.com\//);
  }
  for (const row of PORSCHE_INSTRUCTIONS.steps) {
    assert.equal(row.bookletId, book.id);
    assert.ok(row.pages.includes(row.page));
  }
  assert.deepEqual(PORSCHE_INSTRUCTIONS.steps.filter((row, i, list) => !i || row.section !== list[i - 1].section).map(row => row.number), [1, 22, 88, 117, 154, 220, 281, 306]);
});

test('The selected Turbo route uses 1,363 pieces while the complete box inventory remains 1,458', () => {
  const source = PORSCHE_STEP_PARTS;
  assert.equal(source.calloutRows, 819);
  assert.equal(source.quantityTotal, 1363);
  assert.equal(source.usedElementCount, 362);
  assert.equal(source.steps.reduce((sum, row) => sum + row.parts.length, 0), 819);
  assert.deepEqual(source.steps.map(row => row.id), PORSCHE_INSTRUCTIONS.steps.map(row => row.id));
  const used = new Map();
  for (const row of source.steps) {
    assert.equal(row.quantity, row.parts.reduce((sum, part) => sum + part.quantity, 0));
    for (const part of row.parts) {
      assert.equal(part.bookletId, row.bookletId);
      assert.ok(row.pages.includes(part.page));
      assert.match(part.sourceImageSha256, /^[a-f0-9]{64}$/);
      assert.match(part.sourceImageObject, /^X\d+$/);
      assert.equal(part.assemblyMultiplier, 1);
      assert.equal(part.quantity, part.printedQuantity);
      used.set(part.elementId, (used.get(part.elementId) || 0) + part.quantity);
    }
  }
  const inventory = new Map(PORSCHE_INVENTORY.rows.map(row => [row.elementId, row.quantity]));
  assert.equal(PORSCHE_INVENTORY.quantityTotal, 1458);
  assert.equal(PORSCHE_INVENTORY.publishedPieceCount, 1458);
  assert.equal(inventory.size, 382);
  for (const [element, quantity] of used) assert.ok(quantity <= inventory.get(element), `${element} exceeds the supplied quantity`);
  assert.equal(source.reconciliation.unusedQuantity, 95);
  assert.equal(source.reconciliation.status, 'variant-subset');
  assert.deepEqual(['base', 'turbo'].map(branch => source.steps.filter(row => row.branch === branch).reduce((sum, row) => sum + row.quantity, 0)), [1084, 279]);
});

test('Porsche fragmented illustrations and repeated substeps preserve the actual callouts', () => {
  assert.deepEqual(step(1).parts.map(row => [row.elementId, row.quantity]), [['4188143', 1], ['6299413', 6]]);
  assert.ok(step(15).parts.some(row => row.elementId === '4560182' && row.quantity === 2), 'Fragmented black tile image must not become a rail plate');
  assert.ok(step(195).parts.some(row => row.elementId === '4211425' && row.quantity === 3), 'The plate and brick in a shared image remain distinct');
  assert.ok(step(112).parts.some(row => row.elementId === '6343001' && row.quantity === 2), 'Printed red lamp tile keeps its element identity');
  assert.ok(step(311).parts.some(row => row.elementId === '4124096'));
  assert.deepEqual([18, 90, 292, 364, 365, 366].map(number => step(number).quantity), [18, 30, 20, 8, 4, 2]);
  assert.deepEqual(step(366).parts.map(row => [row.elementId, row.quantity]), [['6343015', 2]]);
  assert.deepEqual(PORSCHE_STEP_PARTS.repeatedSubassemblies, []);
});

test('All 25 Porsche no-new-piece actions use earlier source ranges and the correct branch', () => {
  const actions = PORSCHE_STEP_ACTIONS.actions;
  assert.equal(actions.length, 25);
  assert.equal(new Set(actions.map(row => row.number)).size, 25);
  assert.deepEqual(actions.map(row => row.number), PORSCHE_STEP_PARTS.steps.filter(row => !row.quantity).map(row => row.number));
  for (const action of actions) {
    const official = step(action.number);
    assert.equal(official.quantity, 0);
    assert.equal(action.officialLabel, official.officialLabel);
    assert.ok(official.pages.includes(action.page));
    assert.equal(action.bookletId, official.bookletId);
    assert.ok(action.sourceSteps[0] > 0 && action.sourceSteps[0] <= action.sourceSteps[1]);
    assert.ok(action.sourceSteps[1] < action.number);
    assert.match(action.verification, /visually reviewed/);
  }
  assert.equal(actions.find(row => row.number === 344).kind, 'adjust-assembly');
  assert.equal(actions.find(row => row.number === 347).kind, 'seat-assembly');
  assert.deepEqual(actions.find(row => row.number === 334).sourceSteps, [328, 333]);
  assert.deepEqual(actions.find(row => row.number === 345).sourceSteps, [321, 344]);
});
