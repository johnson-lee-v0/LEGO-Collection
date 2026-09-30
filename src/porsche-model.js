import { PORSCHE_INSTRUCTIONS } from './porsche-instructions.js';
import { PORSCHE_INVENTORY } from './porsche-inventory.js';
import { PORSCHE_BUILD } from './porsche-build-steps.js';

export const BLUEPRINT_ID = 'lego-10295-turbo-v1';
const chapterNames = ['Chassis foundation','Rear chassis and seating','Rear bodywork','Engine fan and front seats','Steering and front bumper','Doors and windscreen','Front bodywork and bonnet','The Turbo finish'];
const colors = ['#9a6039','#aa754c','#8b674a','#687267','#465b50','#84694d'];
export const CHAPTERS = [];
for (const [index, step] of PORSCHE_INSTRUCTIONS.steps.entries()) {
  let chapter = CHAPTERS.at(-1);
  if (!chapter || chapter.section !== step.section) {
    chapter = {id:CHAPTERS.length, section:step.section, title:chapterNames[CHAPTERS.length] || step.sectionLabel,
      start:index, end:index + 1, color:colors[CHAPTERS.length % colors.length]};
    CHAPTERS.push(chapter);
  }
  chapter.end = index + 1;
}
for (const chapter of CHAPTERS) {
  chapter.description = `${chapter.title} · Steps ${PORSCHE_INSTRUCTIONS.steps[chapter.start].officialNumber}–${PORSCHE_INSTRUCTIONS.steps[chapter.end - 1].officialNumber}`;
}

export function createPorscheModel() {
  const mapped = new Map(PORSCHE_BUILD.steps.map(step => [step.id, step]));
  const steps = PORSCHE_INSTRUCTIONS.steps.map((step, index) => {
    const assembly = mapped.get(step.id);
    if (!assembly) throw new Error(`Missing Porsche Turbo assembly step ${step.id}.`);
    return {...step, ...assembly, index,
      chapter:CHAPTERS.find(chapter => index >= chapter.start && index < chapter.end).id};
  });
  const usedQuantity = steps.reduce((total, step) => total + (step.parts || []).reduce((sum, part) => sum + part.quantity, 0), 0);
  const remainingQuantity = PORSCHE_INVENTORY.quantityTotal - usedQuantity;
  return {
    id:BLUEPRINT_ID, blueprintId:BLUEPRINT_ID, kind:'official', buildMode:'instructions',
    title:'Porsche 911 Turbo', shortTitle:'Porsche 911 Turbo', setNumber:'10295', year:2021,
    edition:'Creator Expert · Turbo', tagline:'An icon, from the inside out.',
    displayHeading:'Your 911, assembled.',
    description:'Build the classic 911 Turbo, with its wide rear arches, flat-six engine and distinctive rear spoiler.',
    galleryEyebrow:'PORSCHE 911 · 2021',
    galleryDescription:'The sweeping roofline. The whale-tail spoiler. Build the Turbo.',
    defaultDescription:'My Porsche 911 Turbo, assembled step by step from the LEGO instructions.',
    pieceCount:1458, progressTotal:steps.length, progressUnit:'steps', costPolicy:'unestimated', bricks:[],
    inventory:PORSCHE_INVENTORY, steps, assembly:PORSCHE_BUILD,
    thumbnail:'/official/10295/gallery-preview.png', modelUrl:'/official/10295/model.mpd',
    sceneConfig:{assetRoot:'/official/10295', lineOpacity:.16, instancesUrl:'/official/10295/instances.json'},
    source:{...PORSCHE_INSTRUCTIONS, steps:undefined, setUrl:'https://www.lego.com/en-ca/product/porsche-911-10295'},
    galleryLabel:'Official LEGO set · Turbo build',
    details:{
      instructionNote:`Follow ${steps.length.toLocaleString()} numbered steps for the shared chassis and the Turbo version. The original booklet contains both Turbo and Targa instructions; this build follows the Turbo branch.`,
      inventoryNote:`The Turbo build uses ${usedQuantity.toLocaleString()} pieces. The full printed inventory contains ${PORSCHE_INVENTORY.quantityTotal.toLocaleString()} pieces across ${PORSCHE_INVENTORY.rows.length} element IDs, leaving ${remainingQuantity.toLocaleString()} listed pieces outside this build. The complete set includes the alternate Targa pieces. LEGO publishes 1,458 pieces for the set.`,
      modelNote:'The 3D model is based on Ulrich Röder’s attributed LDraw Turbo reconstruction. Numbered steps use the booklet’s part quantities and catalog identities. Repeated identical parts follow the source assembly order; placement order and joining movements are a prototype reconstruction. Documented source corrections are linked below.',
      scopeNote:'Assembly movements are illustrative. Consult the original booklet for physical connections and moving features.',
      attribution:'Instruction artwork © The LEGO Group. Porsche marks belong to their respective owner. Independent prototype, without LEGO or Porsche endorsement.',
    },
  };
}
