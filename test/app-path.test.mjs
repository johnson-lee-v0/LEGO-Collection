import test from 'node:test';
import assert from 'node:assert/strict';
import { appUrl, appMarkup } from '../src/app-path.js';

test('project hosting preserves queries, nested assets and existing prefixes', () => {
  const base = '/LEGO-Collection/';
  assert.equal(appUrl('/?design=porsche', base), '/LEGO-Collection/?design=porsche');
  assert.equal(appUrl('/official/42115/book-2/pages/008.webp', base), '/LEGO-Collection/official/42115/book-2/pages/008.webp');
  assert.equal(appUrl('/LEGO-Collection/?design=sian', base), '/LEGO-Collection/?design=sian');
  assert.equal(appUrl('/', base), base);
  assert.equal(appUrl('/official/model.mpd', '/'), '/official/model.mpd');
});

test('external, relative and downloadable image URLs retain their meaning', () => {
  for (const value of ['https://www.lego.com/book.pdf#page=12', '//example.com/image.png', '#chapter', './parts.csv', 'data:image/png;base64,abc']) {
    assert.equal(appUrl(value, '/LEGO-Collection/'), value);
  }
});

test('authored HTML links and images use the project base without changing external links', () => {
  const html = '<a href="/?design=chiron" data-nav="/?design=chiron"><img src="/official/42083/gallery-preview.png"></a><a href="https://johnson-lee-v0.github.io/#hobbies">Portfolio</a>';
  const output = appMarkup(html, '/LEGO-Collection/');
  assert.match(output, /href="\/LEGO-Collection\/\?design=chiron"/);
  assert.match(output, /data-nav="\/LEGO-Collection\/\?design=chiron"/);
  assert.match(output, /src="\/LEGO-Collection\/official\/42083\/gallery-preview.png"/);
  assert.match(output, /href="https:\/\/johnson-lee-v0.github.io\/#hobbies"/);
  assert.equal(appMarkup(output, '/LEGO-Collection/'), output);
});
