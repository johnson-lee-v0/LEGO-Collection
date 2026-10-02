import { COLLECTION_CATALOG } from './collection-catalog.js';

export const DEFAULT_MODEL_ALIAS = 'porsche';
export const DEFAULT_BLUEPRINT_ID = 'lego-10295-turbo-v1';
const models = COLLECTION_CATALOG.map(entry => ({
  ...entry, kind:'community-cad', buildMode:'viewer', steps:[],
  modelUrl:`/official/${entry.setNumber}/model.mpd`,
  sceneConfig:{assetRoot:`/official/${entry.setNumber}`,lineOpacity:entry.alias==='porsche'?.16:.10,instancesUrl:`/official/${entry.setNumber}/instances.json`},
}));
export function getModel(idOrAlias = DEFAULT_MODEL_ALIAS) {
  return models.find(model => model.id === idOrAlias || model.alias === idOrAlias);
}
export function listModels() { return models; }
