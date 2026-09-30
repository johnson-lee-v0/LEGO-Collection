import { createSianModel, BLUEPRINT_ID as SIAN_ID, CHAPTERS as SIAN_CHAPTERS } from './sian-model.js';
import { createChironModel, BLUEPRINT_ID as CHIRON_ID, CHAPTERS as CHIRON_CHAPTERS } from './chiron-model.js';
import { createPorscheModel, BLUEPRINT_ID as PORSCHE_ID, CHAPTERS as PORSCHE_CHAPTERS } from './porsche-model.js';

export const DEFAULT_MODEL_ALIAS = 'porsche';
export const DEFAULT_BLUEPRINT_ID = PORSCHE_ID;

const definitions = [
  { id: SIAN_ID, alias: 'sian', title: 'Lamborghini Sián FKP 37', chapters: SIAN_CHAPTERS, create: createSianModel },
  { id: CHIRON_ID, alias: 'chiron', title: 'Bugatti Chiron', chapters: CHIRON_CHAPTERS, create: createChironModel },
  { id: PORSCHE_ID, alias: 'porsche', title: 'Porsche 911 Turbo', chapters: PORSCHE_CHAPTERS, create: createPorscheModel },
];
const instances = new Map();

function definitionFor(idOrAlias = DEFAULT_MODEL_ALIAS) {
  return definitions.find(item => item.id === idOrAlias || item.alias === idOrAlias);
}

/** Each design owns its geometry, piece order, and saved progress. */
export function getModel(idOrAlias = DEFAULT_MODEL_ALIAS) {
  const definition = definitionFor(idOrAlias);
  if (!definition) return undefined;
  if (!instances.has(definition.id)) {
    const model = definition.create();
    const progressTotal = model.progressTotal ?? model.bricks?.length;
    if (!Number.isSafeInteger(progressTotal) || progressTotal < 1) throw new Error(`Model ${definition.id} requires a positive progress total.`);
    instances.set(definition.id, {
      ...model, alias: definition.alias, designLabel: definition.title,
      gallerySection:definition.gallerySection || 'collection',galleryVisible:definition.gallerySection !== 'experiments',
      buildMode: model.buildMode ?? 'geometry', progressTotal,
      progressUnit: model.progressUnit ?? 'pieces',
      pieceCount: model.pieceCount ?? model.bricks?.length,
      costPolicy: model.costPolicy ?? 'estimated',
    });
  }
  return instances.get(definition.id);
}

export function getModelChapters(idOrAlias = DEFAULT_MODEL_ALIAS) {
  return definitionFor(idOrAlias)?.chapters;
}

export function getModelMetadata(idOrAlias = DEFAULT_MODEL_ALIAS) {
  const definition = definitionFor(idOrAlias);
  if (!definition) return undefined;
  const { id, alias, title, chapters } = definition;
  const model = getModel(id);
  return {
    id, blueprintId: id, alias, title, chapters,
    gallerySection:model.gallerySection,galleryVisible:model.galleryVisible,
    totalCount: model.progressTotal, progressTotal: model.progressTotal,
    progressUnit: model.progressUnit, pieceCount: model.pieceCount,
    buildMode: model.buildMode, costPolicy: model.costPolicy,
    modelType: model.kind, dimensionsMm: model.dimensionsMm,
    ...(model.defaultDescription ? { defaultDescription: model.defaultDescription } : {}),
    ...(model.source ? { source: model.source } : {}),
    ...(model.thumbnail ? { thumbnail: model.thumbnail } : {}),
  };
}

export function listModels() { return definitions.map(({ id }) => getModelMetadata(id)); }
