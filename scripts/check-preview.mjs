import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** Catch incomplete canvas exports before they reach the collection gallery. */
export function checkPreviewPng(path) {
  const bytes = readFileSync(path), chunks = [];
  if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error(`Invalid preview PNG: ${path}`);
  let ended = false;
  for (let offset = 8; offset < bytes.length;) {
    if (offset + 12 > bytes.length) throw new Error(`Truncated preview PNG: ${path}`);
    const length = bytes.readUInt32BE(offset), end = offset + length + 12;
    if (end > bytes.length) throw new Error(`Truncated preview PNG: ${path}`);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(bytes.subarray(offset + 8, end - 4));
    if (type === 'IEND') { ended = true; break; }
    offset = end;
  }
  if (!ended || !chunks.length) throw new Error(`Incomplete preview PNG: ${path}`);
  inflateSync(Buffer.concat(chunks));
}
