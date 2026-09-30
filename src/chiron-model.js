import { CHIRON_INSTRUCTIONS } from './chiron-instructions.js';
import { CHIRON_INVENTORY } from './chiron-inventory.js';
import { CHIRON_BUILD } from './chiron-build-steps.js';

export const BLUEPRINT_ID = 'lego-42083-official-v1';
const colors = ['#153e61','#17678b','#375d74','#2c7294','#286284','#182f48'];
export const CHAPTERS = [];
for (const [index, step] of CHIRON_INSTRUCTIONS.steps.entries()) {
  let chapter = CHAPTERS.at(-1);
  if (!chapter || chapter.section !== step.section) {
    chapter = {id:CHAPTERS.length, section:step.section, title:step.sectionLabel,
      start:index, end:index + 1, color:colors[CHAPTERS.length % colors.length]};
    CHAPTERS.push(chapter);
  }
  chapter.end = index + 1;
}
for (const chapter of CHAPTERS) {
  chapter.description = `${chapter.title} · Steps ${CHIRON_INSTRUCTIONS.steps[chapter.start].number}–${CHIRON_INSTRUCTIONS.steps[chapter.end - 1].number}`;
}

export function createChironModel() {
  const mapped = new Map(CHIRON_BUILD.steps.map(step => [step.id, step]));
  const steps = CHIRON_INSTRUCTIONS.steps.map((step, index) => {
    const assembly = mapped.get(step.id);
    if (!assembly) throw new Error(`Missing Chiron assembly step ${step.id}.`);
    return {...step, ...assembly, index,
      chapter:CHAPTERS.find(chapter => index >= chapter.start && index < chapter.end).id};
  });
  return {
    id:BLUEPRINT_ID, blueprintId:BLUEPRINT_ID, kind:'official', buildMode:'instructions',
    title:'Bugatti Chiron', shortTitle:'Bugatti Chiron', setNumber:'42083', year:2018,
    edition:'Technic · 1:8 scale', tagline:'From the W16 engine to the final curve.',
    displayHeading:'Every detail, assembled.',
    description:'Build the Bugatti Chiron from its Technic chassis to its distinctive blue bodywork.',
    galleryEyebrow:'LEGO TECHNIC · 2018',
    galleryDescription:'Two shades of blue. One W16 engine. Bring the Chiron together.',
    defaultDescription:'My Bugatti Chiron, assembled step by step from both LEGO instruction books.',
    pieceCount:3599, progressTotal:steps.length, progressUnit:'steps', costPolicy:'unestimated', bricks:[],
    inventory:CHIRON_INVENTORY, steps, assembly:CHIRON_BUILD,
    thumbnail:'/official/42083/gallery-preview.png', modelUrl:'/official/42083/model.mpd',
    sceneConfig:{assetRoot:'/official/42083', lineOpacity:.10, instancesUrl:'/official/42083/instances.json'},
    source:{...CHIRON_INSTRUCTIONS, steps:undefined, setUrl:'https://www.lego.com/en-ca/product/bugatti-chiron-42083'},
    galleryLabel:'Official LEGO set',
    details:{
      instructionNote:`Both supplied booklets form one continuous build of ${steps.length.toLocaleString()} numbered steps across ${CHAPTERS.length} building chapters.`,
      inventoryNote:`The numbered build uses 3,590 pieces. The printed inventory lists ${CHIRON_INVENTORY.quantityTotal.toLocaleString()} pieces across ${CHIRON_INVENTORY.rows.length} LEGO element IDs, including seven additional black pins and one yellow belt with no identified numbered addition. The published set count is 3,599; its one-piece difference from the printed inventory is unresolved.`,
      modelNote:'The CAD model is a community reconstruction by Philippe Hurbain (Philo), licensed under CC BY 2.0, with documented corrections checked against the booklets. Step quantities follow the LEGO booklets. Positions of repeated identical pieces are reconstructed from the CAD assembly order; stickers are omitted.',
      scopeNote:'This is a digital assembly prototype. It does not simulate the drivetrain, clutch strength or structural loads. Consult the original booklets when building the physical set.',
      attribution:'Instruction artwork © The LEGO Group. Bugatti marks belong to their respective owner. Independent prototype, without LEGO or Bugatti endorsement.',
    },
  };
}
