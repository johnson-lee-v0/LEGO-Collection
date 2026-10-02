import { readdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const output = new URL('../dist/', import.meta.url);
// Publish only the requested three-set collection. The original local project
// retains its private photograph, experiments and legacy persistence service.
for (const entry of readdirSync(output, { withFileTypes: true })) {
  if (entry.name === 'assets' || entry.name === 'official' || entry.name === 'index.html' ||
      ['favicon.svg', 'about.html', 'THIRD-PARTY-NOTICES.txt', 'LICENSE.txt'].includes(entry.name) || /^model-(10295|42083|42115)-inventory\.csv$/.test(entry.name) ||
      /^(sian|chiron|porsche)-official-set\.md$/.test(entry.name)) continue;
  rmSync(new URL(entry.name, output), { recursive: true, force: true });
}
copyFileSync(new URL('../LICENSE', import.meta.url), new URL('LICENSE.txt', output));
writeFileSync(new URL('.nojekyll', output), '');
console.log(`Prepared three-set static collection in ${fileURLToPath(output)}`);
