import test from 'node:test';
import assert from 'node:assert/strict';
import { officialBooklet, officialPdfPage, officialSection, officialStepTitle } from '../src/official-source.js';
import { getModel, getModelMetadata, listModels, DEFAULT_MODEL_ALIAS } from '../src/model-registry.js';

test('multi-book instructions keep the step and inventory page in the correct booklet',()=>{
  const model={setNumber:'42115',source:{booklets:[
    {id:'book-1',title:'Book One',sourceUrl:'https://www.lego.com/book-one.pdf',assetRoot:'/official/42115/book-1'},
    {id:'book-2',title:'Book Two',sourceUrl:'https://www.lego.com/book-two.pdf',assetRoot:'/official/42115/book-2'},
  ]}};
  const step={bookletId:'book-2',page:17,sectionLabel:'Front bodywork'};
  assert.equal(officialBooklet(model,step).title,'Book Two');
  assert.equal(officialPdfPage(model,step),'https://www.lego.com/book-two.pdf#page=17');
  assert.equal(officialSection(model,step),'Front bodywork');
});

test('the public registry contains only the three documented vehicle reconstructions',()=>{
  assert.equal(DEFAULT_MODEL_ALIAS,'porsche');
  assert.deepEqual(listModels().map(item=>item.alias),['sian','chiron','porsche']);
  assert.ok(listModels().every(item=>item.galleryVisible&&item.buildMode==='instructions'));
});

test('alternate build labels preserve the official numbering reset',()=>{
  assert.equal(officialStepTitle({number:305,officialNumber:305,officialLabel:'Base 305'}),'Base step 305');
  assert.equal(officialStepTitle({number:306,officialNumber:1,officialLabel:'Turbo 1'}),'Turbo step 1');
  assert.equal(officialStepTitle({number:24}),'Step 24');
});
