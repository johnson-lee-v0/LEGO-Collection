import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { SIAN_INSTRUCTIONS } from '../src/sian-instructions.js';
import { SIAN_INVENTORY } from '../src/sian-inventory.js';
import { SIAN_STEP_PARTS } from '../src/sian-step-parts.js';
import { SIAN_STEP_ACTIONS } from '../src/sian-step-actions.js';
import { SIAN_STEP_ACTIONS_BOOK2 } from '../src/sian-step-actions-book2.js';

const publicRoot = new URL('../public/', import.meta.url);
const step = number => SIAN_STEP_PARTS.steps.find(item => item.number === number);

test('Both official Sián booklets form one uninterrupted 1084-step sequence', () => {
  const source = SIAN_INSTRUCTIONS;
  assert.equal(source.stepCount, 1084);
  assert.deepEqual(source.booklets.map(book => [book.id, book.pageCount]), [['6392465', 324], ['6394695', 332]]);
  assert.deepEqual(source.steps.map(item => item.number), Array.from({ length: 1084 }, (_, index) => index + 1));
  assert.equal(new Set(source.steps.map(item => item.id)).size, 1084);
  assert.equal(source.steps.filter(item => item.bookletId === '6392465').length, 500);
  assert.equal(source.steps.filter(item => item.bookletId === '6394695').length, 584);
  for (const item of source.steps) {
    const book = source.booklets.find(book => book.id === item.bookletId);
    assert.ok(book);
    assert.ok(item.pages.includes(item.page));
    for (const page of item.pages) {
      assert.ok(page > 0 && page <= book.pageCount);
      assert.match(book.sourceUrl, /^https:\/\/www\.lego\.com\//);
    }
  }
  assert.deepEqual(['box-1', 'box-2', 'box-3', 'box-4', 'box-5', 'box-6'].map(section => source.steps.filter(item => item.section === section).length), [181, 201, 198, 277, 211, 16]);
});

test('The original inventory identities and quantities account for all 3696 supplied pieces', () => {
  const inventory = SIAN_INVENTORY;
  assert.equal(inventory.namespace, 'LEGO element ID');
  assert.equal(inventory.rows.length, 294);
  assert.equal(new Set(inventory.rows.map(row => row.elementId)).size, 294);
  assert.equal(inventory.quantityTotal, 3696);
  assert.equal(inventory.publishedPieceCount, 3696);
  assert.equal(inventory.reconciliation.status, 'matched');
  assert.equal(inventory.rows.reduce((sum, row) => sum + row.quantity, 0), 3696);
  for (const row of inventory.rows) {
    assert.equal(row.bookletId, '6394695');
    assert.ok([324, 325, 326, 327].includes(row.page));
    assert.ok(Number.isSafeInteger(row.quantity) && row.quantity > 0);

  }
});

test('Every official callout reconciles by element while preserving repeated-assembly quantities', () => {
  const source = SIAN_STEP_PARTS;
  assert.equal(source.calloutRows, 2408);
  assert.equal(source.quantityTotal, 3696);
  assert.equal(source.steps.reduce((sum, item) => sum + item.parts.length, 0), 2408);
  assert.deepEqual(source.steps.map(item => item.id), SIAN_INSTRUCTIONS.steps.map(item => item.id));
  const used = new Map();
  for (const item of source.steps) {
    assert.equal(item.quantity, item.parts.reduce((sum, part) => sum + part.quantity, 0));
    for (const part of item.parts) {
      assert.equal(part.bookletId, item.bookletId);
      assert.ok(item.pages.includes(part.page));
      assert.match(part.sourceImageSha256, /^[a-f0-9]{64}$/);
      assert.match(part.sourceImageObject, /^X\d+$/);
      assert.equal(part.quantity, part.printedQuantity * part.assemblyMultiplier);
      used.set(part.elementId, (used.get(part.elementId) || 0) + part.quantity);
    }
  }
  assert.equal(used.size, 294);
  for (const row of SIAN_INVENTORY.rows) assert.equal(used.get(row.elementId), row.quantity, row.elementId);
  for (const [first, last] of [[147, 149], [183, 186], [583, 590]]) {
    for (let number = first; number <= last; number++) assert.ok(step(number).parts.every(part => part.assemblyMultiplier === 2));
  }
  assert.ok(step(381).parts.every(part => part.assemblyMultiplier === 1), 'A repeated single step already gives the combined quantities');
});

test('Visually checked exceptions retain the real additions and exclude box-opening supplies', () => {
  assert.deepEqual(step(1).parts.map(part => [part.elementId, part.quantity]), [['4542573', 1], ['6299413', 2]]);
  assert.equal(step(182).quantity, 6);
  assert.deepEqual(step(182).parts.map(part => part.elementId), ['6299413']);
  assert.deepEqual(step(586).parts.map(part => [part.elementId, part.quantity]), [['6321745', 2]]);
  assert.equal(step(702).parts.filter(part => part.elementId === '6308242').reduce((sum, part) => sum + part.quantity, 0), 1);
  assert.equal(step(702).parts.filter(part => part.elementId === '6279875').reduce((sum, part) => sum + part.quantity, 0), 1);
  assert.deepEqual(SIAN_STEP_PARTS.excludedOverviewCallouts.map(row => [row.bookletId, row.page, row.quantity]), [['6392465', 30, 3], ['6392465', 140, 2]]);
});

test('Reviewed action metadata covers every later no-new-piece step and links its official page', () => {
  const actions = [...SIAN_STEP_ACTIONS.actions, ...SIAN_STEP_ACTIONS_BOOK2.actions];
  const earlyAnchors = [40, 56, 57, 58, 74, 90, 106, 117, 118];
  assert.equal(actions.length, 106);
  assert.equal(new Set(actions.map(action => action.number)).size, 106);
  assert.deepEqual([...earlyAnchors, ...actions.map(action => action.number)].sort((a, b) => a - b), SIAN_STEP_PARTS.steps.filter(step => !step.quantity).map(step => step.number));
  for (const action of actions) {
    const official = step(action.number);
    assert.equal(official.quantity, 0);
    assert.equal(action.bookletId, official.bookletId);
    assert.ok(official.pages.includes(action.page));
    assert.ok(action.sourceSteps[0] > 0 && action.sourceSteps[0] <= action.sourceSteps[1]);
    assert.ok(action.sourceSteps[1] < action.number);
    assert.match(action.verification, /visually reviewed/);
  }
  for (const number of [509, 562, 612, 620, 640, 659, 685, 694, 721, 735, 770, 835, 843, 848, 853, 926]) {
    assert.equal(actions.find(action => action.number === number).kind, 'rotate-assembly', `Step ${number} turns an assembly before the later join`);
  }
});
