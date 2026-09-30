import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { CHIRON_INSTRUCTIONS } from '../src/chiron-instructions.js';
import { CHIRON_INVENTORY } from '../src/chiron-inventory.js';
import { CHIRON_STEP_PARTS } from '../src/chiron-step-parts.js';
import { CHIRON_STEP_ACTIONS } from '../src/chiron-step-actions.js';

const publicRoot = new URL('../public/', import.meta.url);
const step = number => CHIRON_STEP_PARTS.steps[number - 1];

test('Chiron booklets form one uninterrupted 970-step sequence with original source page links', () => {
  const source = CHIRON_INSTRUCTIONS;
  assert.equal(source.stepCount, 970);
  assert.deepEqual(source.booklets.map(book => [book.id, book.pageCount]), [['6257443', 308], ['6257444', 322]]);
  assert.deepEqual(source.steps.map(item => item.number), Array.from({ length: 970 }, (_, index) => index + 1));
  assert.equal(new Set(source.steps.map(item => item.id)).size, 970);
  assert.equal(source.steps.filter(item => item.bookletId === '6257443').length, 479);
  assert.equal(source.steps.filter(item => item.bookletId === '6257444').length, 491);
  for (const book of source.booklets) {
    assert.match(book.sourceSha256, /^[a-f0-9]{64}$/);
    for (let page = 1; page <= book.pageCount; page++) {
      assert.match(book.sourceUrl, /^https:\/\/www\.lego\.com\//);
    }
  }
  for (const item of source.steps) {
    const book = source.booklets.find(book => book.id === item.bookletId);
    assert.ok(book);
    assert.ok(item.pages.includes(item.page));
    assert.ok(item.pages.every(page => page > 0 && page <= book.pageCount));
  }
  assert.deepEqual(['box-1', 'box-2', 'box-3', 'box-4', 'box-5', 'box-6'].map(section => source.steps.filter(item => item.section === section).length), [199, 280, 169, 129, 153, 40]);
});

test('Chiron illustrated inventory preserves 3598 printed pieces separately from 3599 published', () => {
  const inventory = CHIRON_INVENTORY;
  assert.equal(inventory.namespace, 'LEGO element ID');
  assert.equal(inventory.rows.length, 308);
  assert.equal(new Set(inventory.rows.map(row => row.elementId)).size, 308);
  assert.equal(inventory.quantityTotal, 3598);
  assert.equal(inventory.publishedPieceCount, 3599);
  assert.equal(inventory.rows.reduce((sum, row) => sum + row.quantity, 0), 3598);
  for (const row of inventory.rows) {
    assert.equal(row.bookletId, '6257444');
    assert.ok([316, 317, 318, 319].includes(row.page));
    assert.ok(Number.isSafeInteger(row.quantity) && row.quantity > 0);

  }
});

test('Chiron callouts preserve exact quantities and only the documented eight-piece inventory difference', () => {
  const source = CHIRON_STEP_PARTS;
  assert.equal(source.calloutRows, 2212);
  assert.equal(source.quantityTotal, 3590);
  assert.equal(source.steps.reduce((sum, item) => sum + item.parts.length, 0), 2212);
  assert.deepEqual(source.steps.map(item => item.id), CHIRON_INSTRUCTIONS.steps.map(item => item.id));
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
  assert.equal(used.size, 308);
  const differences = CHIRON_INVENTORY.rows.filter(row => used.get(row.elementId) !== row.quantity).map(row => [row.elementId, row.quantity, used.get(row.elementId)]).sort();
  assert.deepEqual(differences, [['4121715', 684, 677], ['4544151', 2, 1]]);
  assert.equal(source.reconciliation.status, 'documented-difference');
  for (const [first, last] of [[26, 40], [162, 169], [233, 237]]) {
    for (let number = first; number <= last; number++) assert.ok(step(number).parts.every(part => part.assemblyMultiplier === 2));
  }
  for (const number of [266, 969]) assert.ok(step(number).parts.every(part => part.assemblyMultiplier === 1), 'Combined callouts must not be multiplied again');
});

test('Exceptional source illustrations are identified and bag-opening supplies are not double-counted', () => {
  assert.deepEqual(step(1).parts.map(part => [part.elementId, part.quantity]), [['4211865', 2], ['4552348', 1]]);
  assert.ok(step(21).parts.some(part => part.elementId === '6016154' && part.quantity === 1 && part.sourceImageObject === 'X16')); 
  assert.deepEqual(step(943).parts.map(part => [part.elementId, part.quantity]), [['6227559', 1]]);
  assert.deepEqual(step(959).parts.map(part => [part.elementId, part.quantity]), [['6227559', 1]]);
  assert.ok(step(957).parts.some(part => part.elementId === '6227567'));
  assert.ok(step(965).parts.some(part => part.elementId === '6178172'));
  assert.equal(step(969).quantity, 12);
  assert.deepEqual(CHIRON_STEP_PARTS.excludedOverviewCallouts.map(row => [row.bookletId, row.page, row.quantity]), [['6257443', 24, 2], ['6257444', 8, 2], ['6257444', 60, 1]]);
});

test('Reviewed Chiron actions cover all 99 no-new-piece steps with earlier source ranges', () => {
  const actions = CHIRON_STEP_ACTIONS.actions;
  assert.equal(actions.length, 99);
  assert.equal(new Set(actions.map(action => action.number)).size, 99);
  assert.deepEqual(actions.map(action => action.number).sort((a, b) => a - b), CHIRON_STEP_PARTS.steps.filter(item => !item.quantity).map(item => item.number));
  for (const action of actions) {
    const official = step(action.number);
    assert.equal(official.quantity, 0);
    assert.equal(action.bookletId, official.bookletId);
    assert.ok(official.pages.includes(action.page));
    assert.ok(action.sourceSteps[0] > 0 && action.sourceSteps[0] <= action.sourceSteps[1]);
    assert.ok(action.sourceSteps[1] < action.number);
    assert.match(action.verification, /visually reviewed/);
  }
  for (const number of [510, 585, 610, 687, 746]) assert.equal(actions.find(action => action.number === number).kind, 'rotate-assembly');
  for (const number of [757, 792, 810, 968]) assert.equal(actions.find(action => action.number === number).kind, 'apply-sticker');
  assert.deepEqual(actions.find(action => action.number === 511).sourceSteps, [500, 509]);
});
