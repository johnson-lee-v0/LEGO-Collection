import { mkdirSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { listModels } from '../src/model-registry.js';
import { checkPreviewPng } from './check-preview.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public');
mkdirSync(output, { recursive: true });
const csv = rows => rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
for (const model of listModels()) {
  checkPreviewPng(resolve(output, model.thumbnail.slice(1)));
  const rows = JSON.parse(readFileSync(resolve(output, `official/${model.setNumber}/model-inventory.json`), 'utf8'));
  if (rows.reduce((total,row) => total + row.quantity, 0) !== model.modeledPieceCount) throw new Error(`Model inventory total does not match ${model.setNumber}.`);
  const credits = `https://johnson-lee-v0.github.io/LEGO-Collection/official/${model.setNumber}/MODEL-CREDITS.md`;
  writeFileSync(resolve(output, `model-${model.setNumber}-inventory.csv`), csv([
    ['LDraw part filename','LDraw color code','Modeled quantity','Model author','Model and library credits'],
    ...rows.map(row => [row.partFile,row.ldrawColor,row.quantity,model.author,credits]),
  ]));
  console.log(`Exported ${model.alias}: ${rows.length} CAD part/color entries, ${model.modeledPieceCount} modeled pieces.`);
}
for (const name of ['sian', 'chiron', 'porsche']) copyFileSync(resolve(root, `docs/${name}-official-set.md`), resolve(output, `${name}-official-set.md`));
