import { Vector3 } from 'three';

/** Bind source instance IDs to the matching CAD object, including nested subassemblies. */
export function bindAssemblyInstances(object,instances) {
  object.updateMatrixWorld(true);
  const candidates=new Map(),used=new Set(),result=new Map();
  object.traverse(node=>{if(!node.isGroup)return;const file=node.name?.toLowerCase();if(!candidates.has(file))candidates.set(file,[]);candidates.get(file).push(node);});
  for(const instance of instances){
    const expected=new Vector3(...instance.position);
    const matches=(candidates.get(instance.partFile.toLowerCase())||[]).filter(n=>!used.has(n)).map(node=>({node,distance:node.getWorldPosition(new Vector3()).distanceTo(expected)})).sort((a,b)=>a.distance-b.distance);
    if(!matches.length||matches[0].distance>.08)throw new Error(`The CAD instance ${instance.id} could not be matched to its assembly position.`);
    const node=matches[0].node;used.add(node);node.userData.instanceId=instance.id;node.userData.sourcePart=instance;result.set(instance.id,node);
  }
  if(result.size!==instances.length)throw new Error('The CAD assembly contains an unmatched part.');
  return result;
}

/** The step map must place each modeled instance exactly once. */
export function validateAssemblyStepMap(steps,instances){
  const known=new Set(instances.map(p=>p.id)),seen=new Set();
  for(const step of steps)for(const id of step.partIds||[]){if(!known.has(id)||seen.has(id))throw new Error(`Invalid or repeated assembly part ${id}`);seen.add(id);}
  if(seen.size!==known.size)throw new Error(`Assembly steps account for ${seen.size} of ${known.size} model pieces.`);
  return true;
}
